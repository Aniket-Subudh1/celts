// routes/faculty.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');

const Batch = require('../models/Batch');
const Submission = require('../models/Submission');
const AuditLog = require('../models/AuditLog');
const StudentStats = require('../models/StudentStats');
const User = require('../models/User');

function avg(arr) {
  if (!Array.isArray(arr)) return null;
  const nums = arr.filter((x) => typeof x === "number" && !Number.isNaN(x));
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 2) / 2;
}



// GET /api/faculty/stats
router.get("/stats", protect, restrictTo(["faculty"]), async (req, res) => {
  try {
    const facultyId = req.user._id;

    // Find batches that belong to THIS faculty
    const facultyBatches = await Batch.find({
      $or: [
        { faculty: facultyId },
        { assignedFaculty: facultyId },
      ],
    })
      .select("_id name students")
      .lean();

    if (!facultyBatches || facultyBatches.length === 0) {
      return res.json({
        summary: {
          totalStudentsInBatches: 0,
          totalStudentsWithAnyTest: 0,
          totalBatches: 0,
          overallAvgBand: null,
          readingAvg: null,
          listeningAvg: null,
          writingAvg: null,
          speakingAvg: null,
        },
        batches: [],
        students: [],
      });
    }

    const batchIdList = facultyBatches.map((b) => b._id);
    const batchNameMap = new Map(
      facultyBatches.map((b) => [String(b._id), b.name])
    );
    const batchStudentCountMap = new Map(
      facultyBatches.map((b) => [
        String(b._id),
        Array.isArray(b.students) ? b.students.length : 0,
      ])
    );

    // Build a map of studentId -> batchName (first batch found)
    const studentBatchNameMap = new Map();
    facultyBatches.forEach((b) => {
      const bName = b.name;
      (b.students || []).forEach((sid) => {
        const sKey = String(sid);
        if (!studentBatchNameMap.has(sKey)) {
          studentBatchNameMap.set(sKey, bName);
        }
      });
    });

    // Collect all student IDs from these batches
    const allStudentIds = [
      ...new Set(
        facultyBatches.flatMap((b) =>
          (b.students || []).map((s) => String(s))
        )
      ),
    ];

    const totalStudentsInBatches = allStudentIds.length;

    // Load StudentStats ONLY for those batches
    const statsDocs = await StudentStats.find({
      batch: { $in: batchIdList },
    }).lean();

    // Load actual User records for these students
    const studentUsers = await User.find({
      _id: { $in: allStudentIds },
      role: 'student',
    })
      .select('_id name email systemId')
      .lean();

    const userMap = new Map(
      studentUsers.map((u) => [String(u._id), u])
    );

    // Map studentId -> StudentStats doc (if exists)
    const statsByStudentId = new Map();
    statsDocs.forEach((s) => {
      if (s.student) {
        statsByStudentId.set(String(s.student), s);
      }
    });

    // If there are no StudentStats yet, still return all batches & all students with null bands
    if (!statsDocs || statsDocs.length === 0) {
      const batches = facultyBatches.map((b) => ({
        _id: String(b._id),
        name: b.name,
        totalStudentsInBatch: Array.isArray(b.students)
          ? b.students.length
          : 0,
        studentsWithAnyTest: 0,
        studentsWithReading: 0,
        studentsWithListening: 0,
        studentsWithWriting: 0,
        studentsWithSpeaking: 0,
        averageBand: null,
        readingBand: null,
        listeningBand: null,
        writingBand: null,
        speakingBand: null,
      }));

      // Build students array from allStudentIds + user data, bands null
      const students = allStudentIds.map((sid) => {
        const u = userMap.get(sid);
        return {
          _id: sid,
          studentId: sid,
          name: u?.name || "",
          email: u?.email || "",
          systemId: u?.systemId || "",
          batchName: studentBatchNameMap.get(sid) || null,
          readingBand: null,
          listeningBand: null,
          writingBand: null,
          speakingBand: null,
          overallBand: null,
        };
      });

      return res.json({
        summary: {
          totalStudentsInBatches,
          totalStudentsWithAnyTest: 0,
          totalBatches: facultyBatches.length,
          overallAvgBand: null,
          readingAvg: null,
          listeningAvg: null,
          writingAvg: null,
          speakingAvg: null,
        },
        batches,
        students,
      });
    }

    // Global summary across this faculty's batches (only students WITH stats)
    const readingBands = statsDocs.map((s) => s.readingBand);
    const listeningBands = statsDocs.map((s) => s.listeningBand);
    const writingBands = statsDocs.map((s) => s.writingBand);
    const speakingBands = statsDocs.map((s) => s.speakingBand);
    const overallBands = statsDocs.map((s) => s.overallBand);

    const summary = {
      totalStudentsInBatches,
      totalStudentsWithAnyTest: statsDocs.length,
      totalBatches: facultyBatches.length,
      overallAvgBand: avg(overallBands),
      readingAvg: avg(readingBands),
      listeningAvg: avg(listeningBands),
      writingAvg: avg(writingBands),
      speakingAvg: avg(speakingBands),
    };

    // Pre-initialise batchMap with ALL faculty batches
    const batchMap = new Map();
    facultyBatches.forEach((b) => {
      const idStr = String(b._id);
      batchMap.set(idStr, {
        _id: idStr,
        name: b.name,
        reading: [],
        listening: [],
        writing: [],
        speaking: [],
        overall: [],
        studentsWithAnyTest: 0,
        studentsWithReading: 0,
        studentsWithListening: 0,
        studentsWithWriting: 0,
        studentsWithSpeaking: 0,
      });
    });

    // Fold StudentStats into the pre-initialised entries
    for (const s of statsDocs) {
      if (!s.batch) continue;
      const batchIdStr = String(s.batch);
      const entry = batchMap.get(batchIdStr);
      if (!entry) continue; // safety

      const hasReading = typeof s.readingBand === "number" && !Number.isNaN(s.readingBand);
      const hasListening = typeof s.listeningBand === "number" && !Number.isNaN(s.listeningBand);
      const hasWriting = typeof s.writingBand === "number" && !Number.isNaN(s.writingBand);
      const hasSpeaking = typeof s.speakingBand === "number" && !Number.isNaN(s.speakingBand);

      const hasAny = hasReading || hasListening || hasWriting || hasSpeaking;

      if (hasAny) entry.studentsWithAnyTest += 1;
      if (hasReading) {
        entry.studentsWithReading += 1;
        entry.reading.push(s.readingBand);
      }
      if (hasListening) {
        entry.studentsWithListening += 1;
        entry.listening.push(s.listeningBand);
      }
      if (hasWriting) {
        entry.studentsWithWriting += 1;
        entry.writing.push(s.writingBand);
      }
      if (hasSpeaking) {
        entry.studentsWithSpeaking += 1;
        entry.speaking.push(s.speakingBand);
      }
      if (
        typeof s.overallBand === "number" &&
        !Number.isNaN(s.overallBand)
      ) {
        entry.overall.push(s.overallBand);
      }
    }

    // Build batches array in the SAME order as facultyBatches
    const batches = facultyBatches.map((b) => {
      const idStr = String(b._id);
      const e = batchMap.get(idStr) || {
        reading: [],
        listening: [],
        writing: [],
        speaking: [],
        overall: [],
        studentsWithAnyTest: 0,
        studentsWithReading: 0,
        studentsWithListening: 0,
        studentsWithWriting: 0,
        studentsWithSpeaking: 0,
      };

      return {
        _id: idStr,
        name: e.name || b.name,
        totalStudentsInBatch: batchStudentCountMap.get(idStr) || 0,
        studentsWithAnyTest: e.studentsWithAnyTest || 0,
        studentsWithReading: e.studentsWithReading || 0,
        studentsWithListening: e.studentsWithListening || 0,
        studentsWithWriting: e.studentsWithWriting || 0,
        studentsWithSpeaking: e.studentsWithSpeaking || 0,
        averageBand: avg(e.overall),
        readingBand: avg(e.reading),
        listeningBand: avg(e.listening),
        writingBand: avg(e.writing),
        speakingBand: avg(e.speaking),
      };
    });

    // Per-student rows: **ALL** students in these batches
    const students = allStudentIds.map((sid) => {
      const u = userMap.get(sid);
      const st = statsByStudentId.get(sid);

      return {
        _id: st?._id && st._id.toString ? st._id.toString() : sid,
        studentId: sid,
        name: u?.name || st?.name || "",
        email: u?.email || st?.email || "",
        systemId: u?.systemId || st?.systemId || "",
        batchName:
          studentBatchNameMap.get(sid) ||
          (st?.batchName || batchNameMap.get(String(st?.batch)) || null),
        readingBand: typeof st?.readingBand === "number" ? st.readingBand : null,
        listeningBand: typeof st?.listeningBand === "number" ? st.listeningBand : null,
        writingBand: typeof st?.writingBand === "number" ? st.writingBand : null,
        speakingBand: typeof st?.speakingBand === "number" ? st.speakingBand : null,
        overallBand: typeof st?.overallBand === "number" ? st.overallBand : null,
      };
    });

    return res.json({
      summary,
      batches,
      students,
    });
  } catch (err) {
    console.error("[Faculty Stats] Error generating stats:", err);
    return res
      .status(500)
      .json({ message: "Server error generating faculty stats" });
  }
}
);


// GET /api/faculty/batches
router.get('/batches', protect, restrictTo(['faculty']), async (req, res) => {
  try {
    const uid = req.user?._id;
    const batches = await Batch.find({ faculty: uid })
      .populate({ path: 'students', select: '_id name email systemId createdAt' })
      .populate({ path: 'faculty', select: '_id name email systemId' })
      .lean();

    // Return as-is so frontend can map and flatten
    res.json(batches);
  } catch (err) {
    console.error('Error fetching faculty batches:', err);
    res.status(500).json({ message: 'Server error fetching batches' });
  }
});


// Faculty view submissions
router.get('/submissions/:testId', protect, restrictTo(['faculty']), async (req, res) => {
  try {
    const submissions = await Submission.find({ testSet: req.params.testId }).populate('student', 'name email');
    return res.json(submissions);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});


// PATCH /api/faculty/students/:statsId/override-band
// Faculty can override WRITING or SPEAKING band for a student
router.patch('/students/:statsId/override-band', protect, restrictTo(['faculty', 'admin']),
  [
    body('skill')
      .isString()
      .withMessage('skill is required')
      .custom((value) => ['writing', 'speaking'].includes(value))
      .withMessage('skill must be either "writing" or "speaking"'),
    body('newBandScore')
      .isFloat({ min: 0, max: 9 })
      .withMessage('newBandScore must be between 0 and 9'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('reason must be a string up to 500 chars'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { statsId } = req.params;
    const { skill, newBandScore, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(statsId)) {
      return res.status(400).json({ message: 'Invalid StudentStats id' });
    }

    try {
      const stats = await StudentStats.findById(statsId).populate('student');
      if (!stats) {
        return res.status(404).json({ message: 'Student stats not found' });
      }

      // If faculty, must have permission flag
      if (
        req.user.role === 'faculty' &&
        (!req.user.facultyPermissions ||
          req.user.facultyPermissions.canEditScores !== true)
      ) {
        return res
          .status(403)
          .json({ message: 'Not allowed to override scores' });
      }

      // skill is "writing" or "speaking"
      const bandField =
        skill === 'writing' ? 'writingBand' : 'speakingBand';

      const oldBand = stats[bandField];
      const newBand = Number(newBandScore);

      // Update StudentStats for that skill
      stats[bandField] = newBand;

      // Recompute overallBand (same logic as in gradingWorker)
      const values = [
        stats.readingBand,
        stats.listeningBand,
        stats.writingBand,
        stats.speakingBand,
      ].filter((v) => typeof v === 'number' && v > 0);

      stats.overallBand = values.length
        ? Math.round(
          (values.reduce((a, b) => a + b, 0) / values.length) * 2
        ) / 2
        : null;

      // optional flag
      stats.hasManualOverride = true;

      await stats.save();

      // Find latest submission for that student & skill
      const studentId = stats.student._id;
      const latestSubmission = await Submission.findOne({
        student: studentId,
        skill,
      }).sort({ createdAt: -1 });

      let submissionInfo = null;
      if (latestSubmission) {
        const oldSubmissionBand = latestSubmission.bandScore;

        // preserve original band if not set yet
        if (
          typeof latestSubmission.originalBandScore !== 'number' ||
          latestSubmission.originalBandScore === null
        ) {
          latestSubmission.originalBandScore = oldSubmissionBand;
        }

        latestSubmission.bandScore = newBand;
        latestSubmission.isOverridden = true;
        latestSubmission.overriddenBy = req.user._id;
        latestSubmission.overrideReason = reason || '';

        await latestSubmission.save();

        submissionInfo = {
          submissionId: latestSubmission._id,
          oldBandScore: oldSubmissionBand,
          newBandScore: latestSubmission.bandScore,
        };

        // Audit log for submission override
        await AuditLog.create({
          action: 'score_override',
          targetType: 'Submission',
          targetId: latestSubmission._id,
          changedBy: req.user._id,
          oldValue: {
            skill,
            bandScore: oldSubmissionBand,
          },
          newValue: {
            skill,
            bandScore: latestSubmission.bandScore,
          },
          reason: reason || '',
        });
      }

      // Audit log for stats change (even if submission is missing)
      await AuditLog.create({
        action: 'student_stats_override',
        targetType: 'StudentStats',
        targetId: stats._id,
        changedBy: req.user._id,
        oldValue: {
          skill,
          band: oldBand,
        },
        newValue: {
          skill,
          band: newBand,
          overallBand: stats.overallBand,
        },
        reason: reason || '',
      });

      return res.json({
        message: 'Band score overridden successfully',
        studentStatsId: stats._id,
        skill,
        oldBand,
        newBand,
        overallBand: stats.overallBand,
        submission: submissionInfo,
      });
    } catch (err) {
      console.error(
        '[PATCH /faculty/students/:statsId/override-band] error:',
        err
      );
      return res
        .status(500)
        .json({ message: 'Server error overriding band score' });
    }
  }
);


// PATCH /api/faculty/submissions/:id/override
router.patch( "/submissions/:id/override", protect, restrictTo(["faculty", "admin"]),
  [
    body("newBandScore")
      .exists()
      .withMessage("newBandScore is required")
      .isFloat({ min: 0, max: 9 })
      .withMessage("newBandScore must be between 0 and 9"),
    body("reason").optional().isString().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { newBandScore, reason } = req.body;

      const submission = await Submission.findById(id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const isAdmin = req.user.role === "admin";
      const facultyCanEdit =
        !!req.user.facultyPermissions &&
        !!req.user.facultyPermissions.canEditScores;

      if (!isAdmin && !facultyCanEdit) {
        return res
          .status(403)
          .json({ message: "Not allowed to override scores" });
      }

      // normalize to 1–9, step 0.5
      function normalizeBand(num) {
        let n = Number(num);
        if (!Number.isFinite(n)) n = 1;
        if (n < 1) n = 1;
        if (n > 9) n = 9;
        return Math.round(n * 2) / 2;
      }

      const normalizedBand = normalizeBand(newBandScore);

      const oldSubmissionBand = submission.bandScore;
      const alreadyOverridden = !!submission.isOverridden;

      // Store original bandScore only first time
      if (!alreadyOverridden) {
        submission.originalBandScore =
          typeof submission.bandScore === "number"
            ? submission.bandScore
            : null;
      }

      submission.bandScore = normalizedBand;
      submission.overrideReason = reason || "";
      submission.overriddenBy = req.user._id;
      submission.isOverridden = true;
      submission.overriddenAt = new Date();

      await submission.save();

      let statsBefore = null;
      let statsAfter = null;

      let stats = await StudentStats.findOne({ student: submission.student });

      if (!stats) {
        // if stats row doesn't exist yet, create a basic one
        stats = new StudentStats({
          student: submission.student,
        });
      }

      // snapshot BEFORE
      statsBefore = {
        readingBand: stats.readingBand,
        listeningBand: stats.listeningBand,
        writingBand: stats.writingBand,
        speakingBand: stats.speakingBand,
        overallBand: stats.overallBand,
      };

      if (submission.skill === "reading") {
        stats.readingBand = normalizedBand;
      } else if (submission.skill === "listening") {
        stats.listeningBand = normalizedBand;
      } else if (submission.skill === "writing") {
        stats.writingBand = normalizedBand;
      } else if (submission.skill === "speaking") {
        stats.speakingBand = normalizedBand;
      }

      // recompute overallBand
      const values = [
        stats.readingBand,
        stats.listeningBand,
        stats.writingBand,
        stats.speakingBand,
      ].filter((v) => typeof v === "number" && v > 0);

      stats.overallBand = values.length
        ? Math.round(
          (values.reduce((a, b) => a + b, 0) / values.length) * 2
        ) / 2
        : null;

      await stats.save();

      statsAfter = {
        readingBand: stats.readingBand,
        listeningBand: stats.listeningBand,
        writingBand: stats.writingBand,
        speakingBand: stats.speakingBand,
        overallBand: stats.overallBand,
      };

      await AuditLog.create({
        action: "submission_score_override",
        targetType: "Submission",
        targetId: submission._id,
        changedBy: req.user._id,
        changedByRole: req.user.role,
        meta: {
          studentId: submission.student,
          testSetId: submission.testSet,
          skill: submission.skill,
        },
        oldValue: {
          bandScore: oldSubmissionBand,
          originalBandScore: submission.originalBandScore ?? null,
        },
        newValue: {
          bandScore: submission.bandScore,
        },
        reason: reason || "",
      });

      await AuditLog.create({
        action: "student_stats_band_update",
        targetType: "StudentStats",
        targetId: stats._id,
        changedBy: req.user._id,
        changedByRole: req.user.role,
        meta: {
          studentId: stats.student,
          skillUpdated: submission.skill,
          viaSubmissionId: submission._id,
        },
        oldValue: statsBefore,
        newValue: statsAfter,
        reason:
          reason ||
          `Band updated via submission override for ${submission.skill}`,
      });

      return res.json({
        message: "Score overridden",
        submission,
      });
    } catch (err) {
      console.error("[PATCH /submissions/:id/override] error:", err);
      return res
        .status(500)
        .json({ message: "Server error overriding score", details: err.message });
    }
  }
);

module.exports = router;
