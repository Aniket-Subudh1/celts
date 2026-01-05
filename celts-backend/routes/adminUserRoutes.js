// routes/adminUserCsvRoutes.js
const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse");
const User = require("../models/User");
const mongoose = require('mongoose'); 
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * Multer - in-memory storage for CSV uploads
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
    },
});

/**
 * Utility: validate email (basic)
 */
function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Utility: normalize and validate role
 */
function normalizeRole(raw) {
    const r = String(raw || "").trim().toLowerCase();
    if (r === "admin") return "admin";
    if (r === "faculty" || r === "teacher") return "faculty";
    // defaulting to student for bulk uploads if not specified correctly
    if (r === "student") return "student";
    return null;
}

/**
 * Utility: serialize user for response (hide password)
 */
function serializeUser(u) {
    return {
        _id: u._id,
        name: u.name,
        email: u.email,
        systemId: u.systemId,
        role: u.role,
        facultyPermissions: u.facultyPermissions || { canEditScores: false },
        cohort: u.cohort || "",
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    };
}

/**
 * POST /api/admin/users/import-csv
 * Field: file (CSV)
 */
router.post(
    "/import-csv",
    protect,
    restrictTo(["admin"]),
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No file uploaded" });
            }

            const csvBuffer = req.file.buffer;
            const rawCsv = csvBuffer.toString("utf-8");

            // Parse CSV
            const records = await new Promise((resolve, reject) => {
                parse(
                    rawCsv,
                    {
                        columns: true,           // use first row as header
                        skip_empty_lines: true,
                        trim: true,
                    },
                    (err, output) => {
                        if (err) return reject(err);
                        resolve(output);
                    }
                );
            });

            if (!records || records.length === 0) {
                return res
                    .status(400)
                    .json({ message: "CSV file is empty or has no data rows" });
            }

            // Clean + validate rows
            const cleanedRows = [];
            const invalidRows = [];

            for (let i = 0; i < records.length; i++) {
                const row = records[i];

                const name = (row.name || "").trim();
                const email = (row.email || "").trim();
                const systemId = (row.systemId || row.systemid || "").trim();
                const password = (row.password || "").trim();
                const role = normalizeRole(row.role);

                // Basic validations
                if (!name || !email || !systemId || !password || !role) {
                    invalidRows.push({
                        index: i + 2, // +2 because header is row 1
                        row,
                        reason: "Missing required fields or invalid role",
                    });
                    continue;
                }

                if (!isValidEmail(email)) {
                    invalidRows.push({
                        index: i + 2,
                        row,
                        reason: "Invalid email format",
                    });
                    continue;
                }

                cleanedRows.push({ name, email, systemId, password, role });
            }

            if (cleanedRows.length === 0) {
                return res.status(400).json({
                    message: "All rows are invalid. No users imported.",
                    invalidRows,
                });
            }

            // Check duplicates against DB in one shot
            const emails = cleanedRows.map((r) => r.email);
            const systemIds = cleanedRows.map((r) => r.systemId);

            const existingUsers = await User.find({
                $or: [{ email: { $in: emails } }, { systemId: { $in: systemIds } }],
            }).select("email systemId");

            const existingEmailSet = new Set(existingUsers.map((u) => u.email));
            const existingSystemIdSet = new Set(existingUsers.map((u) => u.systemId));

            const toInsert = [];
            const skippedDuplicates = [];

            for (const row of cleanedRows) {
                if (existingEmailSet.has(row.email)) {
                    skippedDuplicates.push({
                        email: row.email,
                        systemId: row.systemId,
                        reason: "Email already exists",
                    });
                    continue;
                }
                if (existingSystemIdSet.has(row.systemId)) {
                    skippedDuplicates.push({
                        email: row.email,
                        systemId: row.systemId,
                        reason: "systemId already exists",
                    });
                    continue;
                }

                // Prepare user doc
                toInsert.push({
                    name: row.name,
                    email: row.email,
                    systemId: row.systemId,
                    password: row.password, 
                    role: row.role,
                });
            }

            if (toInsert.length === 0) {
                return res.status(400).json({
                    message: "No new users to insert (all are duplicates or invalid).",
                    invalidRows,
                    skippedDuplicates,
                });
            }

            // Insert users
            const inserted = [];

            for (const doc of toInsert) {
                const user = new User(doc);   
                await user.save();            
                inserted.push(user);
            }

            const serialized = inserted.map(serializeUser);

            return res.status(201).json({
                message: `Imported ${inserted.length} user(s).`,
                summary: {
                    totalRows: records.length,
                    processed: cleanedRows.length,
                    inserted: inserted.length,
                    invalidCount: invalidRows.length,
                    duplicateCount: skippedDuplicates.length,
                },
                users: serialized,
                invalidRows,
                skippedDuplicates,
            });
        } catch (err) {
            console.error("[import-csv] error:", err);
            return res
                .status(500)
                .json({ message: "Server error importing users from CSV" });
        }
    }
);

module.exports = router;
