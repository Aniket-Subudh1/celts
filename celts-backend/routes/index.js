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

router.get('/', (req, res) => res.json({ message: 'CELTS Backend running successfully!', timestamp: Date.now() }));

router.use('/auth', require('./auth'));
router.use('/admin/assign', adminAssignRoutes);
router.use('/proctor', proctorRoutes);
router.use('/media', mediaRoutes);
router.use('/faculty', facultyRoutes);
router.use('/student', studentRoutes);
router.use('/admin/batches', adminBatchRoutes);
router.use('/admin/testSet', adminTestSetsRoutes); 
router.use('/admin/users', adminUserRoutes);
router.use('/admin/csv', csvuploadRoutes);
router.use('/teacher/tests', teacherTestsRoutes);  
router.use('/studentStats', studentStatsRoutes);
router.use('/security', securityRoutes);
router.use('/test', testSecurityRoutes);
router.use('/admin', adminAuditRoutes);
router.use('/admin', adminRoutes);


function isNum(v) {
  return typeof v === "number" && !Number.isNaN(v);
}



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



router.post('/admin/submission/:id/reprocess', protect, restrictTo(['admin', 'faculty']), async (req, res) => {
  const id = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid submission id' });
    const sub = await Submission.findById(id);
    if (!sub) return res.status(404).json({ message: 'Submission not found' });

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



router.get(
  "/admin/student-score",
  protect,
  restrictTo(["admin"]),
  async (req, res) => {
    try {
      const mongoose = require("mongoose");

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

      const users = await User.find({
        _id: { $in: studentIds },
        role: "student",
      })
        .select("_id name email systemId")
        .lean();

      const userMap = new Map(users.map((u) => [String(u._id), u]));

     
      const statsDocs = await StudentStats.find({
        student: { $in: studentIds },
      }).lean();

      const statsByStudentId = new Map(
        statsDocs.map((s) => [String(s.student), s])
      );


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


      const searchLower = search.toLowerCase().trim();

      if (searchLower) {
        allStudentRows = allStudentRows.filter((s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.email.toLowerCase().includes(searchLower) ||
          s.systemId.toLowerCase().includes(searchLower)
        );
      }


      const start = (studentPage - 1) * studentLimit;
      const end = start + studentLimit;

      const paginatedStudents = allStudentRows.slice(start, end);

  
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



router.post('/admin/allow-retry', protect, restrictTo(['admin']), async (req, res) => {
  const { studentId, testId, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(testId)) {
    return res.status(400).json({ message: 'Invalid student or test ID' });
  }

  try {
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