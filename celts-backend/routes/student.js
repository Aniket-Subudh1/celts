// routes/student.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

const Submission = require('../models/Submission');
const TestSet = require('../models/TestSet');
const Batch = require('../models/Batch');
const StudentStats = require('../models/StudentStats');
const { submissionQueue } = require('../services/queue');
const uploadStudentMedia = require('../services/uploadStudentMedia');


// Helper: compute band score from marks 
function computeBandScore(earnedMarks, maxMarks) {
  if (!maxMarks || maxMarks <= 0) return 0;
  const raw = (earnedMarks / maxMarks) * 9;
  return Math.round(raw * 2) / 2;
}

//Helper: update / upsert StudentStats 
async function updateStudentStatsForSkill({ student, skill, bandScore }) {
  if (bandScore == null) return;

  // find ONE batch this student belongs to (if any)
  const batch = await Batch.findOne({ students: student._id }).select('_id name').lean();

  let stats = await StudentStats.findOne({ student: student._id });
  if (!stats) {
    stats = new StudentStats({
      student: student._id,
      name: student.name,
      email: student.email,
      systemId: student.systemId,
      batch: batch ? batch._id : null,
      batchName: batch ? batch.name : null,
    });
  } else {
    // keep name/email/systemId in sync (in case they changed)
    stats.name = student.name;
    stats.email = student.email;
    stats.systemId = student.systemId;
    if (batch) {
      stats.batch = batch._id;
      stats.batchName = batch.name;
    }
  }

  if (skill === 'reading') stats.readingBand = bandScore;
  if (skill === 'listening') stats.listeningBand = bandScore;
  if (skill === 'writing') stats.writingBand = bandScore;
  if (skill === 'speaking') stats.speakingBand = bandScore;

  // compute overall as average of available skills
  const values = [
    stats.readingBand,
    stats.listeningBand,
    stats.writingBand,
    stats.speakingBand,
  ].filter((v) => typeof v === 'number' && v > 0);

  stats.overallBand = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) / 2 : null;

  await stats.save();
}

// GET /api/student/tests 
// Returns tests assigned to student's batches OR directly to student
router.get('/tests', protect, restrictTo(['student']), async (req, res) => {
  try {
    const studentId = req.user._id;

    // Find all batches this student belongs to
    const studentBatches = await Batch.find({ students: studentId })
      .select('_id name program year section')
      .lean();

    const batchIds = studentBatches.map((b) => b._id);

    console.log('[student/tests] student:', String(studentId));
    console.log(
      '[student/tests] batches found:',
      studentBatches.map((b) => ({
        id: String(b._id),
        name: b.name,
      }))
    );

    // Tests assigned via batches or directly
    const orClauses = [{ assignedStudents: studentId }];
    if (batchIds.length > 0) {
      orClauses.push({ assignedBatches: { $in: batchIds } });
    }

    const tests = await TestSet.find({ $or: orClauses })
      .sort({ createdAt: -1 })
      .lean();

    console.log('[student/tests] tests matched:', tests.map((t) => ({
      id: String(t._id),
      title: t.title,
      type: t.type,
      batches: (t.assignedBatches || []).map((x) => String(x)),
    }))
    );

    const normalizedTests = tests.map((t) => {
      const status = 'upcoming';
      return {
        _id: t._id,
        title: t.title,
        type: t.type,
        timeLimitMinutes: t.timeLimitMinutes || 0,
        scheduledDate: t.startTime || t.createdAt || null,
        status,
        bandScores: null,
      };
    });

    return res.json({
      tests: normalizedTests,
      batches: studentBatches.map((b) => ({
        _id: b._id,
        name: b.name,
      })),
    });
  } catch (err) {
    console.error('[GET /student/tests] server error:', err);
    return res.status(500).json({ message: 'Server error fetching tests' });
  }
});





// POST /api/student/submit/:testId/speaking 
// Accepts multipart/form-data with field "media" for audio/video
// ---------- POST /api/student/submit/:testId/speaking ----------
router.post(
  '/submit/:testId/speaking',
  protect,
  restrictTo(['student']),
  uploadStudentMedia.single('media'),
  async (req, res) => {
    const { testId } = req.params;
    const skill = 'speaking';

    try {
      if (!mongoose.Types.ObjectId.isValid(testId)) {
        return res.status(400).json({ message: 'Invalid testId' });
      }

      const testSet = await TestSet.findById(testId);
      if (!testSet) {
        return res.status(404).json({ message: 'Test not found' });
      }

      const allowed = await canStudentStart(testSet, req.user);
      if (!allowed) {
        return res
          .status(403)
          .json({ message: 'Not allowed to start/submit this test now (timing rules)' });
      }

      // response & evaluationPayload come as JSON strings in multipart
      let responseObj = {};
      let evaluationPayload = null;

      if (req.body.response) {
        try {
          responseObj = JSON.parse(req.body.response);
        } catch {
          responseObj = {};
        }
      }

      if (req.body.evaluationPayload) {
        try {
          evaluationPayload = JSON.parse(req.body.evaluationPayload);
        } catch {
          evaluationPayload = null;
        }
      }

      // ✅ Count speaking questions & attempts
      const speakingQuestions = (testSet.questions || []).filter(
        (q) => q.questionType === 'speaking'
      );

      const totalQuestions = speakingQuestions.length;

      // Simplest logic: if we received a media file, treat it as "attempted"
      const attemptedCount = req.file && totalQuestions > 0 ? totalQuestions : 0;
      const unattemptedCount = Math.max(totalQuestions - attemptedCount, 0);

      const submissionPayload = {
        student: req.user._id,
        testSet: testSet._id,
        skill,
        response: responseObj,
        status: 'pending', // will be graded by worker
        totalMarks: 0,
        maxMarks: 0,
        correctCount: 0,
        incorrectCount: 0,
        totalQuestions,
        attemptedCount,
        unattemptedCount,
        bandScore: null,
        mediaPath: req.file ? req.file.path : null,
      };

      const submission = await Submission.create(submissionPayload);

      const jobData = {
        submissionId: submission._id.toString(),
        studentId: req.user._id.toString(),
        testId: testSet._id.toString(),
        skill,
        response: responseObj,
        mediaPath: req.file ? req.file.path : null,
        evaluationPayload,
      };

      const job = await submissionQueue.add(jobData);
      const jobId = job.id || null;

      return res.status(202).json({
        message: 'Speaking submission accepted for grading',
        submissionId: submission._id,
        jobId,
        summary: null,
      });
    } catch (err) {
      console.error('[POST /student/submit/:testId/speaking] error:', err);
      return res.status(500).json({ message: err.message || 'Server error' });
    }
  }
);


// Helper: can student start test?
async function canStudentStart(testSet, student) {
  if (!testSet.startTime) return true;
  const now = new Date();
  const tenMinBefore = new Date(testSet.startTime.getTime() - 10 * 60 * 1000);
  if (now < tenMinBefore) return false;
  if (testSet.endTime && now > testSet.endTime) return false;
  return true;
}



// GET /api/student/tests/:id 
router.get('/tests/:id', protect, restrictTo(['student']), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid test id' });
  }
  const test = await TestSet.findById(id).lean();
  if (!test) return res.status(404).json({ message: 'Test not found' });
  res.json(test);
});



// POST /api/student/submit/:testId/:skill 
// Auto-grades reading/listening MCQs, stores summary and band score.
// Writing/speaking stay 'pending' for async/manual grading.
router.post('/submit/:testId/:skill', protect, restrictTo(['student']), [body('response').notEmpty()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { testId, skill } = req.params;
  if (!mongoose.Types.ObjectId.isValid(testId))
    return res.status(400).json({ message: 'Invalid testId' });

  try {
    const testSet = await TestSet.findById(testId);
    if (!testSet) return res.status(404).json({ message: 'Test not found' });

    const allowed = await canStudentStart(testSet, req.user);
    if (!allowed)
      return res
        .status(403)
        .json({ message: 'Not allowed to start/submit this test now (timing rules)' });

    const response = req.body.response;
    const autoGradable = skill === 'reading' || skill === 'listening';

    let earnedMarks = 0;
    let maxMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let totalQuestions = 0;
    let attemptedCount = 0;
    let unattemptedCount = 0;
    let bandScore = null;

    // Auto grading for reading/listening (MCQ only)
    if (autoGradable) {
      const isArrayResp = Array.isArray(response);

      testSet.questions.forEach((q, idx) => {
        if (q.questionType !== 'mcq') return;

        totalQuestions += 1;

        const qMarks = q.marks || 1;
        maxMarks += qMarks;

        let studentAnswerIndex = null;

        if (isArrayResp) {
          const entry = response.find(
            (r) =>
              r.questionIndex === idx ||
              String(r.questionId) === String(q._id)
          );
          if (entry && typeof entry.answer === 'number') {
            studentAnswerIndex = entry.answer;
          }
        } else if (response && typeof response === 'object') {
          const keyByIndex = String(idx);
          const keyById = q._id ? String(q._id) : null;

          if (
            keyById &&
            response[keyById] &&
            typeof response[keyById].selectedIndex === 'number'
          ) {
            studentAnswerIndex = response[keyById].selectedIndex;
          } else if (
            response[keyByIndex] &&
            typeof response[keyByIndex].selectedIndex === 'number'
          ) {
            studentAnswerIndex = response[keyByIndex].selectedIndex;
          }
        }

        if (typeof studentAnswerIndex === 'number') {
          attemptedCount += 1;

          if (studentAnswerIndex === q.correctIndex) {
            correctCount += 1;
            earnedMarks += qMarks;
          } else {
            incorrectCount += 1;
          }
        } else {
          unattemptedCount += 1;
        }
      });
      bandScore = computeBandScore(earnedMarks, maxMarks || 0);
    }

    // Basic counts for writing/speaking (no auto grading here)
    if (!autoGradable && (skill === 'writing' || skill === 'speaking')) {
      const skillQuestions = (testSet.questions || []).filter(
        (q) => q.questionType === (skill === 'writing' ? 'writing' : 'speaking')
      );

      totalQuestions = skillQuestions.length;
      attemptedCount = skillQuestions.reduce((count, q, idx) => {
        const keyById = q._id ? String(q._id) : null;
        const keyByIndex = String(idx);

        const ans =
          (keyById && response[keyById]) ||
          response[keyByIndex] ||
          null;

        if (skill === 'writing') {
          if (ans && typeof ans.text === 'string' && ans.text.trim().length > 0) {
            return count + 1;
          }
        }

        if (skill === 'speaking') {
          if (ans && typeof ans.uploadedUrl === 'string' && ans.uploadedUrl.trim().length > 0) {
            return count + 1;
          }
        }
        return count;
      }, 0);

      unattemptedCount = Math.max(totalQuestions - attemptedCount, 0);
    }


    // Build submission payload
    const submissionPayload = {
      student: req.user._id,
      testSet: testSet._id,
      skill,
      response,
      status: autoGradable ? 'graded' : 'pending',

      totalMarks: earnedMarks || 0,
      maxMarks: maxMarks || 0,
      correctCount,
      incorrectCount,
      totalQuestions,
      attemptedCount,
      unattemptedCount,
      bandScore: bandScore != null ? bandScore : null,
    };

    const submission = await Submission.create(submissionPayload);

    // Queue job only for non-auto-gradable skills (writing/speaking)
    let jobId = null;
    if (!autoGradable) {
      const jobData = {
        submissionId: submission._id.toString(),
        studentId: req.user._id.toString(),
        testId: testSet._id.toString(),
        skill,
        response,
      };
      const job = await submissionQueue.add(jobData);
      jobId = job.id || null;
    }

    // Update StudentStats (only when we have a bandScore)
    if (bandScore != null) {
      await updateStudentStatsForSkill({
        student: req.user,
        skill,
        bandScore,
      });
    }

    const summary = autoGradable
      ? {
        submissionId: submission._id,
        testId: testSet._id,
        skill,
        totalMarks: submission.totalMarks,
        maxMarks: submission.maxMarks,
        totalQuestions: submission.totalQuestions,
        attemptedCount: submission.attemptedCount,
        unattemptedCount: submission.unattemptedCount,
        correctCount: submission.correctCount,
        incorrectCount: submission.incorrectCount,
        bandScore: submission.bandScore,
      }
      : null;

    return res.status(autoGradable ? 200 : 202).json({
      message: autoGradable
        ? 'Submission accepted and auto-graded'
        : 'Submission accepted for grading',
      submissionId: submission._id,
      jobId,
      summary,
    });
  } catch (err) {
    console.error('[POST /student/submit] error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}
);



// GET /api/student/submissions/:id 
router.get('/submissions/:id', protect, restrictTo(['student']), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid submission id' });
  }

  try {
    const sub = await Submission.findById(id)
      .populate('student', 'name email systemId')
      .populate('testSet', 'title type')
      .lean();

    if (!sub) return res.status(404).json({ message: 'Submission not found' });

    if (String(sub.student?._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not allowed to view this submission' });
    }

    // Decide which summary to expose as the generic "examinerSummary"
      let examinerSummary = null;
      if (sub.skill === 'writing' && sub.geminiWritingEvaluationSummary) {
        examinerSummary = sub.geminiWritingEvaluationSummary;
      } else if (sub.skill === 'speaking' && sub.geminiSpeakingEvaluationSummary) {
        examinerSummary = sub.geminiSpeakingEvaluationSummary;
      } else if (sub.geminiEvaluation && sub.geminiEvaluation.examiner_summary) {
        // fallback to whatever is inside geminiEvaluation
        examinerSummary = sub.geminiEvaluation.examiner_summary;
      }


    return res.json({
      submissionId: sub._id,
      testId: sub.testSet?._id,
      testTitle: sub.testSet?.title,
      skill: sub.skill,
      status: sub.status,

      totalMarks: sub.totalMarks || 0,
      maxMarks: sub.maxMarks || 0,

      totalQuestions: sub.totalQuestions || 0,
      attemptedCount: sub.attemptedCount || 0,
      unattemptedCount: sub.unattemptedCount || 0,

      correctCount: sub.correctCount || 0,
      incorrectCount: sub.incorrectCount || 0,

      geminiEvaluation: sub.geminiEvaluation || null,
      geminiError: sub.geminiError || null,

      bandScore: sub.bandScore ?? null,
      geminiWritingEvaluationSummary: sub.geminiWritingEvaluationSummary ?? null,
      geminiSpeakingEvaluationSummary: sub.geminiSpeakingEvaluationSummary ?? null, 
      examinerSummary,
      
      student: {
        _id: sub.student?._id,
        name: sub.student?.name,
        email: sub.student?.email,
        systemId: sub.student?.systemId,
      },
      createdAt: sub.createdAt,
    });
  } catch (err) {
    console.error('[GET /student/submissions/:id] error:', err);
    return res.status(500).json({ message: 'Server error fetching submission' });
  }
}
);

module.exports = router;
