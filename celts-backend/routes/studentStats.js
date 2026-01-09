// routes/studentStats.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const StudentStats = require('../models/StudentStats');
const Submission = require('../models/Submission');
const { paginate } = require('../utils/pagination');



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
    const paginated = await paginate(req, StudentStats, {
      select: "student systemId overallBand name email",
      sort: { createdAt: -1 },
      defaultLimit: 50,
      maxLimit: 60,
    });

    return res.json({
      students: paginated.data,
      pagination: {
        page: paginated.page,
        limit: paginated.limit,
        total: paginated.total,
        hasNext: paginated.hasNext,
      },
    });

  } catch (err) {
    console.error("[StudentStats admin/all] error:", err);
    return res
      .status(500)
      .json({ message: "Server error fetching all student stats" });
  }
}
);


// Deletes api/student-stats/admin/purge ALL student stats (admin only)
router.delete("/admin/purge", protect, restrictTo(["admin"]), async (req, res) => {
  try {
    const totalCount = await StudentStats.countDocuments();

    if (totalCount === 0) {
      return res.json({
        message: "No student stats found to delete",
        total: 0,
        deleted: 0,
      });
    }

    const deleteResult = await StudentStats.deleteMany({});

    return res.json({
      message: "Student stats purge completed",
      total: totalCount,
      deleted: deleteResult.deletedCount,
      summary: `${deleteResult.deletedCount}/${totalCount} deleted`,
    });
  } catch (err) {
    console.error("[DELETE /student-stats/admin/purge] error:", err);
    return res.status(500).json({
      message: "Failed to purge student stats",
    });
  }
}
);



module.exports = router;
