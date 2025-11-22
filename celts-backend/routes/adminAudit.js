
const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const AuditLog = require("../models/AuditLog");
const Submission = require("../models/Submission");
const User = require("../models/User");
const Batch = require("../models/Batch");

router.get("/audit/overrides", protect, restrictTo(["admin"]), async (req, res) => {
  try {
    const logs = await AuditLog.find({ action: "score_override" })
      .sort({ createdAt: -1 })
      .populate({
        path: "targetId",
        model: "Submission",
        populate: [
          {
            path: "student",
            model: "User",
            select: "name email systemId",
          },
          {
            path: "testSet",
            model: "TestSet",
            select: "type",
          },
        ],
      })
      .populate("changedBy", "name systemId")
      .lean();

    const result = [];

    for (const log of logs) {
      const submission = log.targetId;
      if (!submission || !submission.student) continue;

      const student = submission.student;
      const batchDoc = await Batch.findOne({ students: student._id })
        .select("_id name")
        .lean();

      const batchId = batchDoc ? batchDoc._id.toString() : null;
      const batchName = batchDoc ? batchDoc.name : null;

      result.push({
        _id: log._id.toString(),
        batchId,
        batchName,

        studentId: student._id.toString(),
        studentName: student.name,
        studentSystemId: student.systemId,
        studentEmail: student.email,

        skill: submission.skill,
        oldBandScore: log.oldValue?.bandScore ?? null,
        newBandScore: log.newValue?.bandScore ?? null,

        reason: log.reason || "",
        changedAt: log.createdAt,
        submissionId: submission._id.toString(),

        facultyId: log.changedBy?._id?.toString() || "",
        facultyName: log.changedBy?.name || "Unknown",
        facultySystemId: log.changedBy?.systemId || null,
      });
    }

    return res.json({ logs: result });
  } catch (err) {
    console.error("[GET /admin/audit/overrides] error:", err);
    return res.status(500).json({ message: "Error fetching audit logs" });
  }
}
);

module.exports = router;
