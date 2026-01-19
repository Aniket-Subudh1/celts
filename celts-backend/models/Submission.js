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

  //legacy once project is live remove this 
  mediaPath: {
    type: String,
    default: null,
  },

  mediaPaths: {
      type: Object, 
      default: {},
    },

  status: {
    type: String,
    enum: ['pending', 'queued', 'graded', 'failed'],
    default: 'pending',
  },
  
  // Queue tracking fields for 2K-3K concurrent users
  queuedAt: { type: Date, default: null },
  processingErrors: [{
    timestamp: Date,
    error: String,
    jobId: String,
    attemptsMade: Number,
  }],

  totalMarks: { type: Number, default: 0 },
  maxMarks: { type: Number, default: 0 },

  totalQuestions: { type: Number, default: 0 },
  attemptedCount: { type: Number, default: 0 },
  unattemptedCount: { type: Number, default: 0 },

  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },

  bandScore: { type: Number, default: null },

  originalBandScore: { type: Number, default: null }, // AI band or first band before override
    overrideReason: { type: String, default: "" },
    overriddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isOverridden: { type: Boolean, default: false },
    overriddenAt: { type: Date, default: null },

  // Gemini fields
  geminiEvaluation: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  geminiError: {
    type: String,
    default: null,
  },

  geminiWritingEvaluationSummary: {
    type: String,
    default: null,
  },
  geminiSpeakingEvaluationSummary: {
    type: String,
    default: null,
  },

},
  { timestamps: true }
);

module.exports = mongoose.model('Submission', SubmissionSchema);
