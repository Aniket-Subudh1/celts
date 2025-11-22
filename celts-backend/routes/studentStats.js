// routes/studentStats.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const StudentStats = require('../models/StudentStats');
const Submission = require('../models/Submission');


// GET /api/student/stats  (Returns the logged-in student's aggregated stats
router.get('/stats', protect, restrictTo(['student']), async (req, res) => {
  try {
    const studentId = req.user._id;

    const statsDoc = await StudentStats.findOne({ student: studentId }).lean();

    if (!statsDoc) {
      return res.json(null);
    }

    const overriddenSubs = await Submission.find({
      student: studentId,
      isOverridden: true,
      skill: { $in: ['writing', 'speaking'] },
    })
      .sort({ updatedAt: -1 }) // newest first
      .populate('overriddenBy', 'name systemId email')
      .lean();

    const overrideDetails = {};

    for (const sub of overriddenSubs) {
      const skill = sub.skill; // "writing" or "speaking"

      if (overrideDetails[skill]) continue;

      const faculty = sub.overriddenBy || {};

      overrideDetails[skill] = {
        skill,
        oldBandScore:
          typeof sub.originalBandScore === 'number'
            ? sub.originalBandScore
            : null,
        newBandScore:
          typeof sub.bandScore === 'number' ? sub.bandScore : null,
        reason: sub.overrideReason || '',
        overriddenAt: sub.updatedAt || sub.createdAt || null,
        facultyName: faculty.name || 'Unknown',
        facultySystemId: faculty.systemId || null,
      };
    }

    const result = {
      _id: statsDoc._id,
      student: statsDoc.student,
      name: statsDoc.name,
      email: statsDoc.email,
      systemId: statsDoc.systemId,
      batch: statsDoc.batch,
      batchName: statsDoc.batchName,

      readingBand: statsDoc.readingBand,
      listeningBand: statsDoc.listeningBand,
      writingBand: statsDoc.writingBand,
      speakingBand: statsDoc.speakingBand,
      overallBand: statsDoc.overallBand,

      writingExaminerSummary: statsDoc.writingExaminerSummary || null,
      speakingExaminerSummary: statsDoc.speakingExaminerSummary || null,

      overrideDetails,
    };

    return res.json(result);
  } catch (err) {
    console.error('[GET /student/stats] error:', err);
    return res.status(500).json({
      message: 'Error fetching student stats',
    });
  }
}
);



// Admin view of all student stats
router.get("/admin/all", protect, restrictTo(["admin"]), async (req, res) => {
  try {
    const stats = await StudentStats.find({})
      .select("student systemId overallBand name email")
      .lean();
    return res.json(stats);
  } catch (err) {
    console.error("[StudentStats admin/all] error:", err);
    return res
      .status(500)
      .json({ message: "Server error fetching all student stats" });
  }
}
);


module.exports = router;
