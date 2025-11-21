// models/Submission.js
const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  testSet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestSet',
    required: true,
  },

  skill: {
    type: String,
    enum: ['reading', 'listening', 'writing', 'speaking'],
    required: true,
  },

  response: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },

  mediaPath: {
    type: String,
    default: null,
  },

  status: {
    type: String,
    enum: ['pending', 'graded', 'failed'],
    default: 'pending',
  },

  totalMarks: { type: Number, default: 0 },
  maxMarks: { type: Number, default: 0 },

  totalQuestions: { type: Number, default: 0 },
  attemptedCount: { type: Number, default: 0 },
  unattemptedCount: { type: Number, default: 0 },

  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },

  bandScore: { type: Number, default: null },

  // Gemini fields
  geminiEvaluation: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  geminiError: {
    type: String,
    default: null,
  },
},
  { timestamps: true }
);

module.exports = mongoose.model('Submission', SubmissionSchema);
