const mongoose = require('mongoose');

const TestAttemptSchema = new mongoose.Schema({
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

  attemptNumber: {
    type: Number,
    default: 1,
  },

  status: {
    type: String,
    enum: ['started', 'completed', 'abandoned', 'violation_exit'],
    default: 'started',
  },

  startedAt: {
    type: Date,
    default: Date.now,
  },

  completedAt: {
    type: Date,
    default: null,
  },

  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    default: null,
  },

  exitReason: {
    type: String,
    enum: ['completed', 'fullscreen_exit', 'tab_switch', 'time_expired', 'violation', 'manual_exit'],
    default: null,
  },

  violations: [{
    type: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: String,
  }],

  isRetryAllowed: {
    type: Boolean,
    default: false, // Admin can override this
  },

  retryAllowedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  retryAllowedAt: {
    type: Date,
    default: null,
  },

  retryReason: {
    type: String,
    default: null,
  },

}, { timestamps: true });

// Index for efficient queries
TestAttemptSchema.index({ student: 1, testSet: 1 });
TestAttemptSchema.index({ student: 1, testSet: 1, status: 1 });

// Prevent multiple active attempts for same student/test combination
TestAttemptSchema.index(
  { student: 1, testSet: 1, status: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { status: 'started' },
    name: 'unique_active_attempt'
  }
);

module.exports = mongoose.model('TestAttempt', TestAttemptSchema);