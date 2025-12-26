// routes/adminTests.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const TestSet = require('../models/TestSet');
const Batch = require('../models/Batch');
const { protect, restrictTo } = require('../middleware/authMiddleware');

/* =====================================================
   CREATE TEST (ADMIN)
===================================================== */
router.post('/', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const payload = req.body;
    const { title, type, questions } = payload;

    if (
      !title ||
      !type ||
      !['reading', 'listening', 'writing', 'speaking'].includes(type)
    ) {
      return res
        .status(400)
        .json({ message: 'Invalid test payload: title and valid type required' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res
        .status(400)
        .json({ message: 'At least one question is required' });
    }

    // Reading validation
    if (type === 'reading') {
      if (
        !Array.isArray(payload.readingSections) ||
        payload.readingSections.length === 0
      ) {
        return res.status(400).json({
          message: 'Reading tests require at least one passage',
        });
      }
    }

    // Listening validation
    if (type === 'listening') {
      if (
        !Array.isArray(payload.listeningSections) ||
        payload.listeningSections.length === 0
      ) {
        return res.status(400).json({
          message: 'Listening tests require at least one audio block',
        });
      }
    }

    const test = await TestSet.create({
      title: payload.title,
      description: payload.description || '',
      type: payload.type,

      passage: payload.passage || '',
      audioUrl: payload.audioUrl || '',
      listenLimit: Number(payload.listenLimit || 1),

      readingSections: payload.readingSections || [],
      listeningSections: payload.listeningSections || [],
      questions: payload.questions,

      timeLimitMinutes: Number(payload.timeLimitMinutes || 0),
      startTime: payload.startTime ? new Date(payload.startTime) : null,
      endTime: payload.endTime ? new Date(payload.endTime) : null,

      assignedBatches: [],
      assignedStudents: [],

      createdBy: req.user._id,
      published: payload.published === true,
    });

    return res.status(201).json({ message: 'Admin test created', test });
  } catch (err) {
    console.error('Admin create test error:', err);
    return res.status(500).json({ message: 'Server error creating test' });
  }
});

/* =====================================================
   GET ADMIN TESTS (ONLY OWN)
===================================================== */
router.get('/', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const tests = await TestSet.find({ createdBy: req.user._id })
      .populate('createdBy', 'name email')
      .populate('assignedBatches', 'name section year')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(tests);
  } catch (err) {
    console.error('Admin fetch tests error:', err);
    return res.status(500).json({ message: 'Server error fetching tests' });
  }
});

/**
 * GET /admin/tests/faculty
 * Admin fetches ALL tests created by FACULTY
 */
// routes/adminTests.js
router.get(
  '/faculty', // keep the URL if frontend already uses it
  protect,
  restrictTo(['admin']),
  async (req, res) => {
    try {
      const tests = await TestSet.find({})
        .populate('createdBy', 'name email systemId')
        .sort({ createdAt: -1 })
        .lean();

      return res.json(tests);
    } catch (err) {
      console.error('Admin fetch tests error:', err);
      return res
        .status(500)
        .json({ message: 'Server error fetching tests' });
    }
  }
);


/* =====================================================
   GET TEST BY ID (ADMIN)
===================================================== */
router.get('/:id', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid test id' });
    }

    const test = await TestSet.findOne({
      _id: id,
      createdBy: req.user._id,
    })
      .populate('assignedBatches', 'name section year')
      .lean();

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    return res.json(test);
  } catch (err) {
    console.error('Admin get test error:', err);
    return res.status(500).json({ message: 'Server error fetching test' });
  }
});



/* =====================================================
   UPDATE TEST (ADMIN)
===================================================== */
router.put('/:id', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid test id' });
    }

    const test = await TestSet.findOneAndUpdate(
      { _id: id, createdBy: req.user._id },
      req.body,
      { new: true, runValidators: true }
    ).lean();

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    return res.json({ message: 'Test updated', test });
  } catch (err) {
    console.error('Admin update test error:', err);
    return res.status(500).json({ message: 'Server error updating test' });
  }
});

/* =====================================================
   DELETE TEST (ADMIN)
===================================================== */
router.delete('/:id', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid test id' });
    }

    const deleted = await TestSet.findOneAndDelete({
      _id: id,
      createdBy: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Test not found' });
    }

    return res.json({ message: 'Test deleted' });
  } catch (err) {
    console.error('Admin delete test error:', err);
    return res.status(500).json({ message: 'Server error deleting test' });
  }
});

/* =====================================================
   ASSIGN BATCHES (ADMIN)
===================================================== */
router.patch(
  '/:id/assign-batches',
  protect,
  restrictTo(['admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { batchIds } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid test id' });
      }

      if (!Array.isArray(batchIds)) {
        return res.status(400).json({ message: 'batchIds must be an array' });
      }

      // Validate batches exist
      const batches = await Batch.find({ _id: { $in: batchIds } }).select('_id');
      const validBatchIds = batches.map(b => b._id);

      const test = await TestSet.findOneAndUpdate(
        { _id: id, createdBy: req.user._id },
        { assignedBatches: validBatchIds },
        { new: true }
      ).lean();

      if (!test) {
        return res.status(404).json({ message: 'Test not found' });
      }

      return res.json({ message: 'Batches assigned', test });
    } catch (err) {
      console.error('Assign batches error:', err);
      return res.status(500).json({ message: 'Server error assigning batches' });
    }
  }
);

module.exports = router;
