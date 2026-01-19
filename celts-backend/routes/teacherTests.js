// routes/teacherTests.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const TestSet = require('../models/TestSet');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { paginate } = require('../utils/pagination');


// Create test (teacher)
router.post('/', protect, restrictTo(['faculty']), async (req, res) => {
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

    // READING: require at least one passage block (readingSections)
    if (type === 'reading') {
      if (
        !Array.isArray(payload.readingSections) ||
        payload.readingSections.length === 0
      ) {
        return res.status(400).json({
          message:
            'Reading tests require at least one passage in readingSections.',
        });
      }
    }

    // LISTENING: require at least one audio block (listeningSections)
    if (type === 'listening') {
      if (
        !Array.isArray(payload.listeningSections) ||
        payload.listeningSections.length === 0
      ) {
        return res.status(400).json({
          message:
            'Listening tests require at least one audio block in listeningSections.',
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

      readingSections: Array.isArray(payload.readingSections)
        ? payload.readingSections
        : [],
      listeningSections: Array.isArray(payload.listeningSections)
        ? payload.listeningSections
        : [],

      questions: payload.questions,

      timeLimitMinutes: Number(payload.timeLimitMinutes || 0),
      startTime: payload.startTime ? new Date(payload.startTime) : null,
      endTime: payload.endTime ? new Date(payload.endTime) : null,
      assignedBatches: Array.isArray(payload.assignedBatches)
        ? payload.assignedBatches
        : [],
      assignedStudents: Array.isArray(payload.assignedStudents)
        ? payload.assignedStudents
        : [],
      createdBy: req.user._id,
      published: payload.published === true,
    });

    return res.status(201).json({ message: 'Test created', test });
  } catch (err) {
    console.error('Error creating test:', err);
    return res.status(500).json({ message: 'Server error creating test' });
  }
});

// Get tests created by teacher (or all assigned to them)
router.get('/', protect, restrictTo(['faculty']), async (req, res) => {
  try {
    const filter = {};
    if (req.query.mine === 'true') filter.createdBy = req.user._id;
    // const tests = await TestSet.find(filter)
    //   .populate('createdBy', 'name email')
    //   .lean();
    // return res.json(tests);
    const paginated = await paginate(req, TestSet, {
      filter,
      populate: [{ path: 'createdBy', select: 'name email' }],
      sort: { createdAt: -1 },
      defaultLimit: 50,
      maxLimit: 60,
    });

    return res.json({
      tests: paginated.data,
      pagination: {
        page: paginated.page,
        limit: paginated.limit,
        total: paginated.total,
        hasNext: paginated.hasNext,
      },
    });
    
  } catch (err) {
    console.error('Error fetching tests:', err);
    return res.status(500).json({ message: 'Server error fetching tests' });
  }
});


// Get by id
router.get('/:id', protect, restrictTo(['faculty']), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: 'Invalid id' });
    const test = await TestSet.findById(id).lean();
    if (!test) return res.status(404).json({ message: 'Test not found' });
    return res.json(test);
  } catch (err) {
    console.error('Error fetching test:', err);
    return res.status(500).json({ message: 'Server error fetching test' });
  }
});



// Update test
router.put('/:id', protect, restrictTo(['faculty']), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: 'Invalid id' });

    const updates = req.body;
    const test = await TestSet.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).lean();
    if (!test) return res.status(404).json({ message: 'Test not found' });
    return res.json({ message: 'Test updated', test });
  } catch (err) {
    console.error('Error updating test:', err);
    return res.status(500).json({ message: 'Server error updating test' });
  }
});



// Delete test
router.delete('/:id', protect, restrictTo(['faculty']), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: 'Invalid id' });
    const deleted = await TestSet.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Test not found' });
    return res.json({ message: 'Test deleted' });
  } catch (err) {
    console.error('Error deleting test:', err);
    return res.status(500).json({ message: 'Server error deleting test' });
  }
});





// PATCH /teacher/tests/:id/assign-batches
router.patch(
  '/:id/assign-batches',
  protect,
  restrictTo(['faculty']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { batchIds = [], mode = 'add' } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid test id' });
      }

      if (!Array.isArray(batchIds)) {
        return res.status(400).json({ message: 'batchIds must be an array' });
      }

      const test = await TestSet.findById(id);
      if (!test) {
        return res.status(404).json({ message: 'Test not found' });
      }

      // Ensure faculty owns the test
      if (String(test.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Not allowed to modify this test' });
      }

      const existing = new Set(
        (test.assignedBatches || []).map((b) => String(b))
      );

      if (mode === 'remove') {
        batchIds.forEach((id) => existing.delete(String(id)));
      } else {
        batchIds.forEach((id) => existing.add(String(id)));
      }

      test.assignedBatches = Array.from(existing);
      await test.save();

      return res.json({
        message: 'Batches updated',
        test,
      });
    } catch (err) {
      console.error('[teacher assign-batches] error:', err);
      return res.status(500).json({ message: 'Server error assigning batches' });
    }
  }
);



module.exports = router;