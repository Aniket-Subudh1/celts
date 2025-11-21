// routes/studentStats.js
const express = require('express');
const router = express.Router();

const StudentStats = require('../models/StudentStats');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// GET /api/student/stats  (Returns the logged-in student's aggregated stats)

router.get('/stats', protect, restrictTo(['student']), async (req, res) => {
  try {
    const stats = await StudentStats.findOne({ student: req.user._id }).lean();
    if (!stats) {
      return res.status(200).json(null);
    }

    return res.json(stats);
  } catch (err) {
    console.error('[StudentStats] Error fetching stats:', err);
    return res
      .status(500)
      .json({ message: 'Server error fetching student stats' });
  }
});



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
