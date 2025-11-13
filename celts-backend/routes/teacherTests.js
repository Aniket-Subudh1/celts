// routes/teacherTests.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const TestSet = require('../models/TestSet');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Create test (teacher)
router.post('/', protect, restrictTo(['faculty']), async (req, res) => {
    try {
        const payload = req.body;

        // basic validation
        const { title, type, questions } = payload;
        if (!title || !type || !['reading', 'listening', 'writing', 'speaking'].includes(type)) {
            return res.status(400).json({ message: 'Invalid test payload: title and valid type required' });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'At least one question is required' });
        }

        // Additional listening constraints: audioUrl present
        if (type === 'listening' && !payload.audioUrl) {
            return res.status(400).json({ message: 'Listening tests require audioUrl' });
        }

        const test = await TestSet.create({
            title: payload.title,
            description: payload.description || '',
            type: payload.type,
            passage: payload.passage || '',
            audioUrl: payload.audioUrl || '',
            listenLimit: Number(payload.listenLimit || 1),
            questions: payload.questions,
            timeLimitMinutes: Number(payload.timeLimitMinutes || 0),
            assignedBatches: Array.isArray(payload.assignedBatches) ? payload.assignedBatches : [],
            assignedStudents: Array.isArray(payload.assignedStudents) ? payload.assignedStudents : [],
            createdBy: req.user._id,
            published: payload.published === true
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
        // optionally support query ?mine=true to fetch only createdBy
        const filter = {};
        if (req.query.mine === 'true') filter.createdBy = req.user._id;
        // else show tests assigned to faculty's batches? you can customize
        const tests = await TestSet.find(filter).populate('createdBy', 'name email').lean();
        return res.json(tests);
    } catch (err) {
        console.error('Error fetching tests:', err);
        return res.status(500).json({ message: 'Server error fetching tests' });
    }
});

// Get by id
router.get('/:id', protect, restrictTo(['faculty']), async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
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
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

        const updates = req.body;
        const test = await TestSet.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
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
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
        const deleted = await TestSet.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: 'Test not found' });
        return res.json({ message: 'Test deleted' });
    } catch (err) {
        console.error('Error deleting test:', err);
        return res.status(500).json({ message: 'Server error deleting test' });
    }
});

module.exports = router;
