
const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const AuditLog = require("../models/AuditLog");
const Submission = require("../models/Submission");
const User = require("../models/User");
const Batch = require("../models/Batch");
const { paginate } = require("../utils/pagination");

router.get("/audit/overrides", protect, restrictTo(["admin"]), async (req, res) => {
  try {
    const paginated = await paginate(req, AuditLog, {
      filter: { action: "score_override" },
      sort: { createdAt: -1 },
      populate: [{
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
      },
      {
        path: "changedBy",
        model: "User",
        select: "name systemId",
      },
    ],
    });
      
    const result = [];

    for (const log of paginated.data) {
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
        batchId: batchDoc?._id?.toString() || null,
        batchName: batchDoc?.name || null,

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
