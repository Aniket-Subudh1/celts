// routes/faculty.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');

const Batch = require('../models/Batch');
const Submission = require('../models/Submission');
const AuditLog = require('../models/AuditLog');
const { body, validationResult } = require('express-validator');
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


// Faculty override (if faculty has permission)
router.patch('/submissions/:id/override', protect, restrictTo(['faculty']), [
  body('newBandScore').isNumeric(),
  body('reason').optional().isString()
], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (!req.user.facultyPermissions || !req.user.facultyPermissions.canEditScores) return res.status(403).json({ message: 'Not allowed to override scores' });
    const old = submission.bandScore;
    submission.originalBandScore = old;
    submission.bandScore = req.body.newBandScore;
    submission.overrideReason = req.body.reason || '';
    submission.overriddenBy = req.user._id;
    submission.isOverridden = true;
    await submission.save();

    // Create audit log
    await AuditLog.create({
      action: 'score_override',
      targetType: 'Submission',
      targetId: submission._id,
      changedBy: req.user._id,
      oldValue: { bandScore: old },
      newValue: { bandScore: submission.bandScore },
      reason: req.body.reason || ''
    });

    return res.json({ message: 'Score overridden', submission });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;
