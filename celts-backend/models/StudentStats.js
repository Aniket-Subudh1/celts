// models/StudentStats.js
const mongoose = require('mongoose');

const StudentStatsSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      required: true,
    },

    // snapshot for analytics
    name: { type: String },
    email: { type: String },
    systemId: { type: String },

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
    batchName: { type: String, default: null },

    // Bands (0–9 or null) – latest band per skill
    readingBand: { type: Number, default: null },
    listeningBand: { type: Number, default: null },
    writingBand: { type: Number, default: null },
    speakingBand: { type: Number, default: null },

    // latest examiner summary for writing (from AI)
    writingExaminerSummary: { type: String, default: null },
    speakingExaminerSummary: { type: String, default: null },

    // overall band (average of available bands)
    overallBand: { type: Number, default: null },

    hasManualOverride: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('StudentStats', StudentStatsSchema);
