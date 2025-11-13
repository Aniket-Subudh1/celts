// routes/faculty.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');

const Batch = require('../models/Batch'); 
const Submission = require('../models/Submission');
const AuditLog = require('../models/AuditLog');
const { body, validationResult } = require('express-validator');


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
    const submissions = await Submission.find({ testSet: req.params.testId }).populate('student','name email');
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
