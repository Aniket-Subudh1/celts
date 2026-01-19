// routes/index.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const TestSet = require('../models/TestSet');
const Submission = require('../models/Submission');
const Batch = require('../models/Batch');
const StudentStats = require("../models/StudentStats");

const { protect, restrictTo } = require('../middleware/authMiddleware');
const { submissionQueue } = require('../services/queue');

const adminAssignRoutes = require('./adminAssignments');
const adminBatchRoutes = require('./adminBatches');
const proctorRoutes = require('./proctor');
const mediaRoutes = require('./media');
const facultyRoutes = require('./faculty');
const studentRoutes = require('./student');
const teacherTestsRoutes = require('./teacherTests');
const studentStatsRoutes = require('./studentStats');
const adminAuditRoutes = require("./adminAudit");
const securityRoutes = require('./security');
const testSecurityRoutes = require('./testSecurity');
const adminRoutes = require('./admin');
const adminUserRoutes = require('./adminUserRoutes');
const csvuploadRoutes = require('./adminUserRoutes');
const adminTestSetsRoutes = require('./adminTestSets');

const { paginate } = require("../utils/pagination");



// Root health check
router.get('/', (req, res) => res.json({ message: 'CELTS Backend running successfully!', timestamp: Date.now() }));

// Mount other routers (these files should exist and export a router)
router.use('/auth', require('./auth'));
router.use('/admin/assign', adminAssignRoutes);
router.use('/proctor', proctorRoutes);
router.use('/media', mediaRoutes);
router.use('/faculty', facultyRoutes);
router.use('/student', studentRoutes);
router.use('/admin/batches', adminBatchRoutes);
router.use('/teacher/tests', teacherTestsRoutes);  //faculty access
router.use('/admin/testSet', adminTestSetsRoutes); // admin access
router.use('/studentStats', studentStatsRoutes);
router.use("/admin", adminAuditRoutes);
router.use('/security', securityRoutes);
router.use('/test', testSecurityRoutes); // Development/testing only
router.use('/admin', adminRoutes);
router.use('/admin/users', adminUserRoutes); 
router.use('/admin/csv',csvuploadRoutes) 


function isNum(v) {
  return typeof v === "number" && !Number.isNaN(v);
}


// ADMIN: Get user
router.get('/admin/users', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    //const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).lean();
    //res.json(users);
    const result = await paginate(req, User, {
      filter,
      select: '-password',
      sort: { createdAt: -1 },
    });
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});



// ADMIN: Create / Onboard user (enhanced with optional immediate assignment)
router.post('/admin/users', protect, restrictTo(['admin']), async (req, res) => {
  const { name, email, systemId, password, role, canEditScores = false, assignedFaculty, cohort } = req.body;
  try {
    if (!name || !email || !systemId || !password) return res.status(400).json({ message: 'name, email, id and password are required' });

    if (await User.findOne({ email })) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({
      name,
      email,
      systemId,
      password,
      role,
      facultyPermissions: { canEditScores },
      cohort: cohort || ''
    });

    // If admin provided assignedFaculty for a student, attach bidirectionally (best-effort)
    if (assignedFaculty && role === 'student' && mongoose.Types.ObjectId.isValid(assignedFaculty)) {
      const faculty = await User.findById(assignedFaculty);
      if (faculty && faculty.role === 'faculty') {
        user.assignedFaculty = faculty._id;
        await user.save();
        if (!Array.isArray(faculty.students)) faculty.students = [];
        if (!faculty.students.find(id => id.toString() === user._id.toString())) {
          faculty.students.push(user._id);
          await faculty.save();
        }
      }
    }

    return res.status(201).json({ message: `${role} account created successfully.`, user: user.toJSON() });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({ message: 'Error creating user', details: error.message });
  }
});


// ADMIN: Update user
router.put('/admin/users/:id', protect, restrictTo(['admin']), async (req, res) => {
  const id = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const allowed = ['name', 'email', 'systemId', 'role', 'cohort', 'assignedFaculty', 'facultyPermissions'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // If facultyPermissions passed as an object, only accept canEditScores boolean
    if (updates.facultyPermissions && typeof updates.facultyPermissions === 'object') {
      updates.facultyPermissions = { canEditScores: Boolean(updates.facultyPermissions.canEditScores) };
    }

    // If changing assignedFaculty ensure valid faculty id or null
    if (updates.assignedFaculty) {
      if (!mongoose.Types.ObjectId.isValid(updates.assignedFaculty)) {
        return res.status(400).json({ message: 'Invalid assignedFaculty id' });
      }
      const fac = await User.findById(updates.assignedFaculty);
      if (!fac || fac.role !== 'faculty') return res.status(400).json({ message: 'Assigned user is not a faculty' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Keep track of old assignedFaculty to update reverse refs if needed
    const oldAssigned = user.assignedFaculty ? user.assignedFaculty.toString() : null;

    // apply updates
    Object.assign(user, updates);
    await user.save();

    // If assignedFaculty changed and user is a student -> ensure bidirectional ref
    if (user.role === 'student') {
      const newAssigned = user.assignedFaculty ? user.assignedFaculty.toString() : null;
      if (oldAssigned !== newAssigned) {
        // remove from old faculty.students
        if (oldAssigned && mongoose.Types.ObjectId.isValid(oldAssigned)) {
          const oldFac = await User.findById(oldAssigned);
          if (oldFac && Array.isArray(oldFac.students)) {
            oldFac.students = oldFac.students.filter(sid => sid.toString() !== user._id.toString());
            await oldFac.save();
          }
        }
        // add to new faculty.students
        if (newAssigned && mongoose.Types.ObjectId.isValid(newAssigned)) {
          const newFac = await User.findById(newAssigned);
          if (newFac && newFac.role === 'faculty') {
            newFac.students = newFac.students || [];
            if (!newFac.students.find(sid => sid.toString() === user._id.toString())) {
              newFac.students.push(user._id);
              await newFac.save();
            }
          }
        }
      }
    }

    const out = user.toObject();
    delete out.password;
    res.json({ message: 'User updated', user: out });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Error updating user', details: error.message });
  }
});


// ADMIN: Delete User
router.delete('/admin/users/:id', protect, restrictTo(['admin']), async (req, res) => {
  const id = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clean up relationships if needed
    if (user.role === 'student' && user.assignedFaculty) {
      await User.updateOne(
        { _id: user.assignedFaculty },
        { $pull: { students: user._id } }
      );
    }

    if (user.role === 'faculty' && Array.isArray(user.students) && user.students.length > 0) {
      await User.updateMany(
        { _id: { $in: user.students } },
        { $unset: { assignedFaculty: "" } }
      );
    }

    await User.findByIdAndDelete(id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Error deleting user', details: error.message });
  }
});


// ADMIN: Reset user password
router.patch('/admin/users/:id/password', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (!newPassword || newPassword.length < 4) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 4 characters.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;

    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[Admin change password] error:', err);
    return res
      .status(500)
      .json({ message: 'Server error updating password' });
  }
}
);



// ADMIN: Update faculty permissions 
router.patch('/admin/faculty/:id/permissions', protect, restrictTo(['admin']), async (req, res) => {
  const { canEditScores } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid faculty id' });
    const faculty = await User.findById(req.params.id);
    if (!faculty || faculty.role !== 'faculty') return res.status(404).json({ message: 'Faculty user not found' });
    faculty.facultyPermissions.canEditScores = Boolean(canEditScores);
    await faculty.save();
    return res.json({ message: `Faculty ${faculty.name} permissions updated. Can edit scores: ${faculty.facultyPermissions.canEditScores}` });
  } catch (error) {
    console.error('Update faculty permissions error:', error);
    return res.status(500).json({ message: 'Error updating permissions', details: error.message });
  }
});



// ADMIN: Analytics (simple live metrics)
router.get('/admin/analytics', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTests = await TestSet.countDocuments();
    const totalSubmissions = await Submission.countDocuments();
    const agg = await Submission.aggregate([
      { $match: { bandScore: { $gt: 0 } } },
      { $group: { _id: null, avgBand: { $avg: '$bandScore' } } }
    ]);
    const avgOverallBandScore = (agg[0] && agg[0].avgBand) ? Number(agg[0].avgBand.toFixed(2)) : null;

    return res.json({
      totalUsers,
      totalTests,
      totalSubmissions,
      avgOverallBandScore: avgOverallBandScore || 6.5,
      message: 'Comprehensive analytics dashboard data.'
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ message: 'Error generating analytics', details: error.message });
  }
});



// Student submission status endpoint 
router.get('/student/submission/:id/status', protect, restrictTo(['student']), async (req, res) => {
  const id = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid submission id' });
    const submission = await Submission.findById(id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (submission.student.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });
    return res.json({ status: submission.status, bandScore: submission.bandScore, aiFeedback: submission.aiFeedback });
  } catch (error) {
    console.error('Submission status error:', error);
    return res.status(500).json({ message: 'Error fetching submission status', details: error.message });
  }
});



// Admin or faculty with permission might want to re-run scoring 
router.post('/admin/submission/:id/reprocess', protect, restrictTo(['admin', 'faculty']), async (req, res) => {
  const id = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid submission id' });
    const sub = await Submission.findById(id);
    if (!sub) return res.status(404).json({ message: 'Submission not found' });

    // Enqueue processing again
    const jobData = {
      submissionId: sub._id.toString(),
      studentId: sub.student.toString(),
      testId: sub.testSet.toString(),
      skill: sub.skill,
      response: sub.response
    };
    const job = await submissionQueue.add(jobData);
    return res.json({ message: 'Reprocess job queued', jobId: job.id || null });
  } catch (error) {
    console.error('Reprocess submission error:', error);
    return res.status(500).json({ message: 'Error queuing reprocess', details: error.message });
  }
});


// GET /api/admin/tests
router.get("/admin/tests", protect, restrictTo(["admin"]), async (req, res) => {
  try {
    const result = await paginate(req, TestSet, {
      populate: [{ path: "createdBy", select: "name systemId" }],
      sort: { createdAt: -1 },
      map: (t) => ({
        _id: t._id,
        title: t.title,
        description: t.description || "",
        type: t.type,
        timeLimitMinutes: t.timeLimitMinutes || null,
        startTime: t.startTime || null,
        endTime: t.endTime || null,
        readingSections: t.readingSections || [],
        listeningSections: t.listeningSections || [],
        questions: (t.questions || []).filter(
          (q) => q && typeof q === "object" && q.questionType
        ),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        assignedBatches: t.assignedBatches || [],
        assignedStudents: t.assignedStudents || [],
        createdBy: t.createdBy
          ? {
            _id: t.createdBy._id,
            name: t.createdBy.name,
            systemId: t.createdBy.systemId,
          }
          : null,
      }),
    });

    return res.json(result);
  } catch (err) {
    console.error("[GET /admin/tests] error:", err);
    return res
      .status(500)
      .json({ message: "Server error fetching test sets" });
  }
}
);


// GET /api/admin/tests/:id
router.get("/admin/tests/:id", protect, restrictTo(["admin"]), async (req, res) => {
  const { id } = req.params;

  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid test id" });
  }

  try {
    const test = await TestSet.findById(id)
      .populate("createdBy", "name systemId")
      .lean();

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    return res.json({
      _id: test._id,
      title: test.title,
      description: test.description || "",
      type: test.type,
      timeLimitMinutes: test.timeLimitMinutes || null,
      startTime: test.startTime || null,
      endTime: test.endTime || null,
      readingSections: test.readingSections || [],
      listeningSections: test.listeningSections || [],
      questions: (test.questions || []).filter(
        (q) => q && typeof q === "object" && q.questionType
      ),
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      assignedBatches: test.assignedBatches || [],
      assignedStudents: test.assignedStudents || [],
      createdBy: test.createdBy
        ? {
          _id: test.createdBy._id,
          name: test.createdBy.name,
          systemId: test.createdBy.systemId,
        }
        : null,
    });
  } catch (err) {
    console.error("[GET /admin/tests/:id] error:", err);
    return res
      .status(500)
      .json({ message: "Server error fetching test set" });
  }
}
);



// GET /api/admin/student-score
router.get(
  "/admin/student-score",
  protect,
  restrictTo(["admin"]),
  async (req, res) => {
    try {
      const mongoose = require("mongoose");

      /* ======================================================
         HELPERS
      ====================================================== */
      function isNum(v) {
        return typeof v === "number" && !Number.isNaN(v);
      }

      function avg(arr = []) {
        const nums = arr.filter(isNum);
        if (!nums.length) return null;
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      }

      function emptySummary() {
        return {
          totalStudentsInBatches: 0,
          totalStudentsWithAnyTest: 0,
          totalBatches: 0,
          overallAvgBand: null,
          readingAvg: null,
          listeningAvg: null,
          writingAvg: null,
          speakingAvg: null,
        };
      }

      /* ======================================================
         QUERY PARAMS
      ====================================================== */
      const {
        batchId,
        search = "",
        page = 1,
        limit = 10,
      } = req.query;

      const batchPage = Math.max(1, parseInt(req.query.batchPage) || 1);
      const batchLimit = Math.min(50, parseInt(req.query.batchLimit) || 10);

      const studentPage = Math.max(1, parseInt(page));
      const studentLimit = Math.min(100, parseInt(limit));

      /* ======================================================
         BATCH PAGINATION + SEARCH
      ====================================================== */
      req.query.page = batchPage;
      req.query.limit = batchLimit;
      req.query.search = search;

      const batchPaginationResult = await paginate(req, Batch, {
        select: "_id name students",
        searchFields: ["name"],
        sort: { createdAt: -1 },
        defaultLimit: 10,
      });

      const batches = batchPaginationResult.data.map((b) => ({
        _id: String(b._id),
        name: b.name,
        students: b.students || [],
        totalStudentsInBatch: Array.isArray(b.students)
          ? b.students.length
          : 0,
      }));

      if (!batches.length) {
        return res.json({
          summary: emptySummary(),
          batches: [],
          batchPagination: {
            page: batchPage,
            limit: batchLimit,
            total: 0,
            hasNext: false,
          },
          students: [],
          studentPagination: {
            page: 1,
            limit: 0,
            total: 0,
            hasNext: false,
          },
        });
      }

      /* ======================================================
         STUDENT IDS (SOURCE OF TRUTH = Batch.students)
      ====================================================== */
      let studentIds = [];

      if (batchId && mongoose.Types.ObjectId.isValid(batchId)) {
        const batch = await Batch.findById(batchId)
          .select("students")
          .lean();

        studentIds = batch?.students?.map(String) || [];
      } else {
        studentIds = batches.flatMap((b) =>
          (b.students || []).map(String)
        );
      }

      studentIds = [...new Set(studentIds)];

      /* ======================================================
         USERS
      ====================================================== */
      const users = await User.find({
        _id: { $in: studentIds },
        role: "student",
      })
        .select("_id name email systemId")
        .lean();

      const userMap = new Map(users.map((u) => [String(u._id), u]));

      /* ======================================================
         STUDENT STATS (OPTIONAL)
      ====================================================== */
      const statsDocs = await StudentStats.find({
        student: { $in: studentIds },
      }).lean();

      const statsByStudentId = new Map(
        statsDocs.map((s) => [String(s.student), s])
      );

      /* ======================================================
         BUILD FULL STUDENT ROWS (INCLUDING NO-STATS)
      ====================================================== */
      let allStudentRows = studentIds.map((sid) => {
        const u = userMap.get(sid);
        const st = statsByStudentId.get(sid);

        return {
          _id: st?._id?.toString() || sid,
          studentId: sid,
          name: u?.name || st?.name || "",
          email: u?.email || st?.email || "",
          systemId: u?.systemId || st?.systemId || "",
          batchName: st?.batchName || null,

          readingBand: isNum(st?.readingBand) ? st.readingBand : null,
          listeningBand: isNum(st?.listeningBand) ? st.listeningBand : null,
          writingBand: isNum(st?.writingBand) ? st.writingBand : null,
          speakingBand: isNum(st?.speakingBand) ? st.speakingBand : null,
          overallBand: isNum(st?.overallBand) ? st.overallBand : null,
          writingExaminerSummary: st?.writingExaminerSummary || null,
          speakingExaminerSummary: st?.speakingExaminerSummary || null,
        };
      });

      /* ======================================================
         STUDENT SEARCH
      ====================================================== */
      const searchLower = search.toLowerCase().trim();

      if (searchLower) {
        allStudentRows = allStudentRows.filter((s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.email.toLowerCase().includes(searchLower) ||
          s.systemId.toLowerCase().includes(searchLower)
        );
      }

      /* ======================================================
         STUDENT PAGINATION (AFTER BUILD + SEARCH)
      ====================================================== */
      const start = (studentPage - 1) * studentLimit;
      const end = start + studentLimit;

      const paginatedStudents = allStudentRows.slice(start, end);

      /* ======================================================
         SUMMARY (GLOBAL)
      ====================================================== */
      const summary = {
        totalStudentsInBatches: studentIds.length,
        totalStudentsWithAnyTest: statsDocs.length,
        totalBatches: batchPaginationResult.total,
        overallAvgBand: avg(statsDocs.map((s) => s.overallBand)),
        readingAvg: avg(statsDocs.map((s) => s.readingBand)),
        listeningAvg: avg(statsDocs.map((s) => s.listeningBand)),
        writingAvg: avg(statsDocs.map((s) => s.writingBand)),
        speakingAvg: avg(statsDocs.map((s) => s.speakingBand)),
      };

      /* ======================================================
         RESPONSE
      ====================================================== */
      return res.json({
        summary,

        batches: batches.map((b) => ({
          _id: b._id,
          name: b.name,
          totalStudentsInBatch: b.totalStudentsInBatch,
        })),

        batchPagination: {
          page: batchPage,
          limit: batchLimit,
          total: batchPaginationResult.total,
          hasNext: batchPage * batchLimit < batchPaginationResult.total,
        },

        students: paginatedStudents,

        studentPagination: {
          page: studentPage,
          limit: studentLimit,
          total: allStudentRows.length,
          hasNext: end < allStudentRows.length,
        },
      });
    } catch (err) {
      console.error("[Admin Student Score] Error:", err);
      return res.status(500).json({
        message: "Server error generating admin student score",
      });
    }
  }
);



// GET /api/admin/test-attempts - View all test attempts
router.get('/admin/test-attempts', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { studentId, testId, status, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      filter.student = studentId;
    }
    if (testId && mongoose.Types.ObjectId.isValid(testId)) {
      filter.testSet = testId;
    }
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const attempts = await TestAttempt.find(filter)
      .populate('student', 'name email systemId')
      .populate('testSet', 'title type')
      .populate('retryAllowedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TestAttempt.countDocuments(filter);

    res.json({
      attempts,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total
      }
    });
  } catch (err) {
    console.error('[GET /admin/test-attempts] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


// POST /api/admin/allow-retry - Allow a student to retry a test
router.post('/admin/allow-retry', protect, restrictTo(['admin']), async (req, res) => {
  const { studentId, testId, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(testId)) {
    return res.status(400).json({ message: 'Invalid student or test ID' });
  }

  try {
    // Find the latest attempt for this student and test
    const attempt = await TestAttempt.findOne({
      student: studentId,
      testSet: testId
    }).sort({ attemptNumber: -1 });

    if (!attempt) {
      return res.status(404).json({ message: 'No test attempt found' });
    }

    if (attempt.status === 'started') {
      return res.status(400).json({ message: 'Test is currently in progress' });
    }

    // Allow retry
    attempt.isRetryAllowed = true;
    attempt.retryAllowedBy = req.user._id;
    attempt.retryAllowedAt = new Date();
    attempt.retryReason = reason || 'Admin override';

    await attempt.save();

    res.json({
      message: 'Retry permission granted',
      attempt: {
        _id: attempt._id,
        student: attempt.student,
        testSet: attempt.testSet,
        attemptNumber: attempt.attemptNumber,
        isRetryAllowed: attempt.isRetryAllowed,
        retryReason: attempt.retryReason
      }
    });

  } catch (err) {
    console.error('[POST /admin/allow-retry] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


// POST /api/admin/revoke-retry - Revoke retry permission
router.post('/admin/revoke-retry', protect, restrictTo(['admin']), async (req, res) => {
  const { studentId, testId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(testId)) {
    return res.status(400).json({ message: 'Invalid student or test ID' });
  }

  try {
    const attempt = await TestAttempt.findOne({
      student: studentId,
      testSet: testId,
      isRetryAllowed: true
    }).sort({ attemptNumber: -1 });

    if (!attempt) {
      return res.status(404).json({ message: 'No retry permission found' });
    }

    attempt.isRetryAllowed = false;
    attempt.retryAllowedBy = null;
    attempt.retryAllowedAt = null;
    attempt.retryReason = null;

    await attempt.save();

    res.json({ message: 'Retry permission revoked' });

  } catch (err) {
    console.error('[POST /admin/revoke-retry] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router;