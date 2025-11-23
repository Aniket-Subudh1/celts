// routes/admin.js
const express = require('express');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const TestAttempt = require('../models/TestAttempt');
const User = require('../models/User');
const TestSet = require('../models/TestSet');
const router = express.Router();

router.get('/secret', protect, restrictTo(['admin']), (req, res) => {
  res.json({ message: `Hello Admin ${req.user.name}`, user: { id: req.user._id, email: req.user.email } });
});

// GET /api/admin/test-attempts - View all test attempts
router.get('/test-attempts', protect, restrictTo(['admin']), async (req, res) => {
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
router.post('/allow-retry', protect, restrictTo(['admin']), async (req, res) => {
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
router.post('/revoke-retry', protect, restrictTo(['admin']), async (req, res) => {
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
