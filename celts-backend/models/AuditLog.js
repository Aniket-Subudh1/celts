// models/AuditLog.js
const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // e.g. "submission_score_override"
    targetType: { type: String, required: true }, // "Submission", "StudentStats", etc.
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedByRole: { type: String, default: null }, // "admin" | "faculty"

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },

    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);
