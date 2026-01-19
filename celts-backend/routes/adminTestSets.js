// routes/adminTests.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const TestSet = require('../models/TestSet');
const Batch = require('../models/Batch');
const Submission = require('../models/Submission');
const { protect, restrictTo } = require('../middleware/authMiddleware');

//ADMIN CREATE TEST
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



//GET TEST CREATED BY ADMIN
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
 * Admin fetches ALL tests 
 */
router.get('/faculty', protect, restrictTo(['admin']), async (req, res) => {
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




//GET TEST BY ID (ADMIN)
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



//UPDATE TEST (ADMIN)
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


//DELETE TEST (ADMIN)
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


//ASSIGN BATCHES TO TEST
router.patch('/:id/assign-batches', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { batchIds, mode = "add" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid test id" });
    }

    if (!Array.isArray(batchIds) || batchIds.length === 0) {
      return res.status(400).json({ message: "batchIds must be a non-empty array" });
    }

    // Normalize batch IDs
    const normalizedBatchIds = batchIds
      .filter((bid) => mongoose.Types.ObjectId.isValid(bid))
      .map((bid) => new mongoose.Types.ObjectId(bid));

    if (normalizedBatchIds.length === 0) {
      return res.status(400).json({ message: "No valid batchIds provided" });
    }

    let updateQuery = {};

    if (mode === "remove") {
      // REMOVE batches
      updateQuery = {
        $pull: {
          assignedBatches: { $in: normalizedBatchIds },
        },
      };
    } else {
      // ADD batches (default)
      updateQuery = {
        $addToSet: {
          assignedBatches: { $each: normalizedBatchIds },
        },
      };
    }

    const test = await TestSet.findOneAndUpdate(
      { _id: id, createdBy: req.user._id },
      updateQuery,
      { new: true }
    ).populate("assignedBatches", "name section year");

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    return res.json({
      message:
        mode === "remove"
          ? "Batch removed successfully"
          : "Batches assigned successfully",
      test,
    });
  } catch (err) {
    console.error("Assign/remove batches error:", err);
    return res.status(500).json({
      message: "Server error updating batch assignments",
    });
  }
}
);


//Get Batches + Tests
// routes/adminTestSets.js
router.get(
  "/:testId/batches",
  protect,
  restrictTo(["admin"]),
  async (req, res) => {
    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ message: "Invalid testId" });
    }

    const test = await TestSet.findOne({
      _id: testId,
      createdBy: req.user._id,
    }).lean();

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    const batches = await Batch.find({
      _id: { $in: test.assignedBatches || [] },
    })
      .populate("students", "name email systemId")
      .lean();

    res.json({
      testId,
      batches: batches.map((b) => ({
        _id: b._id,
        name: b.name,
        students: b.students || [],
      })),
    });
  }
);


//Get Scores from submission
router.get(
  "/:testId/batch/:batchId/scores",
  protect,
  restrictTo(["admin"]),
  async (req, res) => {
    const { testId, batchId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(testId) ||
      !mongoose.Types.ObjectId.isValid(batchId)
    ) {
      return res.status(400).json({ message: "Invalid ids" });
    }

    // verify ownership
    const test = await TestSet.findOne({
      _id: testId,
      createdBy: req.user._id,
    }).lean();

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    const batch = await Batch.findById(batchId)
      .populate("students", "name email systemId")
      .lean();

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const studentIds = batch.students.map((s) => s._id);

    const submissions = await Submission.find({
      testSet: testId,
      skill: test.type,
      student: { $in: studentIds },
    })
      .populate("student", "name email systemId")
      .lean();

    // group by student
    const map = {};
    submissions.forEach((sub) => {
      const sid = String(sub.student._id);
      if (!map[sid]) {
        map[sid] = {
          student: sub.student,
          skills: {},
        };
      }
      map[sid].skills[sub.skill] = {
        bandScore: sub.bandScore,
        totalMarks: sub.totalMarks,
        maxMarks: sub.maxMarks,
        status: sub.status,
      };
    });

    res.json({
      testId,
      batchId,
      results: Object.values(map),
    });
  }
);


// GET SUBMISSIONS (ADMIN SCORE CARD)
//  GET /admin/testSet/:testId/batch/:batchId/submissions
router.get("/:testId/batch/:batchId/submissions", protect, restrictTo(["admin"]), async (req, res) => {
  try {
    const { testId, batchId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(testId) ||
      !mongoose.Types.ObjectId.isValid(batchId)
    ) {
      return res.status(400).json({ message: "Invalid ids" });
    }

    // Verify test ownership
    const test = await TestSet.findOne({
      _id: testId,
      createdBy: req.user._id,
    })
      .select("_id type")
      .lean();

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    // Get batch students
    const batch = await Batch.findById(batchId)
      .select("students")
      .lean();

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (!batch.students || batch.students.length === 0) {
      return res.json([]);
    }

    // Fetch submissions ONLY for test skill
    const submissions = await Submission.find({
      testSet: testId,
      skill: test.type, 
      student: { $in: batch.students },
    })
      .populate("student", "name email systemId")
      .sort({ createdAt: -1 })
      .lean();

    // Normalize for frontend
    const result = submissions.map((s) => ({
      _id: s._id,

      student: {
        _id: s.student?._id,
        name: s.student?.name || "Unknown",
        email: s.student?.email || "",
        systemId: s.student?.systemId || "",
      },

      status: s.status,

      totalMarks: s.totalMarks || 0,
      maxMarks: s.maxMarks || 0,

      bandScore:
        typeof s.bandScore === "number" ? s.bandScore : null,

      correctCount: s.correctCount ?? 0,
      incorrectCount: s.incorrectCount ?? 0,
      unattemptedCount: s.unattemptedCount ?? 0,

      createdAt: s.createdAt,
    }));

    return res.json(result);
  } catch (err) {
    console.error("Admin submissions error:", err);
    return res.status(500).json({
      message: "Server error fetching submissions",
    });
  }
}
);



module.exports = router;
