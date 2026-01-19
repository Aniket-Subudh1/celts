const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse");
const User = require("../models/User");
const mongoose = require('mongoose'); 
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { paginate } = require("../utils/pagination");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, 
    },
});

function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}


function normalizeRole(raw) {
    const r = String(raw || "").trim().toLowerCase();
    if (r === "admin") return "admin";
    if (r === "faculty" || r === "teacher") return "faculty";
    if (r === "student") return "student";
    return null;
}


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
 * POST /api/admin/csv/import-csv
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

router.get('/', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    
    // If 'all=true' query param is provided, return all users without pagination
    if (req.query.all === 'true') {
      const users = await User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .lean();
      
      return res.json({ data: users, total: users.length });
    }

    // Default: paginated response
    const result = await paginate(req, User, {
      filter,
      select: '-password',
      sort: { createdAt: -1 },
    });
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

router.post('/', protect, restrictTo(['admin']), async (req, res) => {
  const { name, email, systemId, password, role, canEditScores = false, assignedFaculty, cohort } = req.body;
  try {
    if (!name || !email || !systemId || !password) return res.status(400).json({ message: 'name, email, id and password are required' });

    const existingUser = await User.findOne({ 
      $or: [{ email }, { systemId }] 
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      if (existingUser.systemId === systemId) {
        return res.status(400).json({ message: 'User with this roll number (systemId) already exists' });
      }
    }

    const user = await User.create({
      name,
      email,
      systemId,
      password,
      role,
      facultyPermissions: { canEditScores },
      cohort: cohort || ''
    });

    if (assignedFaculty && role === 'student' && mongoose.Types.ObjectId.isValid(assignedFaculty)) {
      const faculty = await User.findById(assignedFaculty);
      if (faculty && faculty.role === 'faculty') {
        user.assignedFaculty = faculty._id;
        await user.save();
        if (!Array.isArray(faculty.students)) faculty.students = [];
        if (!faculty.students.find(id => id.toString() === user._id.toString())) {
          faculty.students.push(user._id);
          await faculty.save();
        }
      }
    }

    return res.status(201).json({ message: `${role} account created successfully.`, user: user.toJSON() });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({ message: 'Error creating user', details: error.message });
  }
});

router.put('/:id', protect, restrictTo(['admin']), async (req, res) => {
  const id = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const allowed = ['name', 'email', 'systemId', 'role', 'cohort', 'assignedFaculty', 'facultyPermissions'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.facultyPermissions && typeof updates.facultyPermissions === 'object') {
      updates.facultyPermissions = { canEditScores: Boolean(updates.facultyPermissions.canEditScores) };
    }

    if (updates.assignedFaculty) {
      if (!mongoose.Types.ObjectId.isValid(updates.assignedFaculty)) {
        return res.status(400).json({ message: 'Invalid assignedFaculty id' });
      }
      const fac = await User.findById(updates.assignedFaculty);
      if (!fac || fac.role !== 'faculty') return res.status(400).json({ message: 'Assigned user is not a faculty' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check for duplicate email or systemId if they're being changed
    if (updates.email && updates.email !== user.email) {
      const emailExists = await User.findOne({ email: updates.email });
      if (emailExists) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
    }
    
    if (updates.systemId && updates.systemId !== user.systemId) {
      const systemIdExists = await User.findOne({ systemId: updates.systemId });
      if (systemIdExists) {
        return res.status(400).json({ message: 'User with this roll number (systemId) already exists' });
      }
    }

    const oldAssigned = user.assignedFaculty ? user.assignedFaculty.toString() : null;

    Object.assign(user, updates);
    await user.save();

    if (user.role === 'student') {
      const newAssigned = user.assignedFaculty ? user.assignedFaculty.toString() : null;
      if (oldAssigned !== newAssigned) {
        if (oldAssigned && mongoose.Types.ObjectId.isValid(oldAssigned)) {
          const oldFac = await User.findById(oldAssigned);
          if (oldFac && Array.isArray(oldFac.students)) {
            oldFac.students = oldFac.students.filter(sid => sid.toString() !== user._id.toString());
            await oldFac.save();
          }
        }
        // add to new faculty.students
        if (newAssigned && mongoose.Types.ObjectId.isValid(newAssigned)) {
          const newFac = await User.findById(newAssigned);
          if (newFac && newFac.role === 'faculty') {
            newFac.students = newFac.students || [];
            if (!newFac.students.find(sid => sid.toString() === user._id.toString())) {
              newFac.students.push(user._id);
              await newFac.save();
            }
          }
        }
      }
    }

    const out = user.toObject();
    delete out.password;
    res.json({ message: 'User updated', user: out });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Error updating user', details: error.message });
  }
});

router.delete('/:id', protect, restrictTo(['admin']), async (req, res) => {
  const id = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'student' && user.assignedFaculty) {
      await User.updateOne(
        { _id: user.assignedFaculty },
        { $pull: { students: user._id } }
      );
    }

    if (user.role === 'faculty' && Array.isArray(user.students) && user.students.length > 0) {
      await User.updateMany(
        { _id: { $in: user.students } },
        { $unset: { assignedFaculty: "" } }
      );
    }

    await User.findByIdAndDelete(id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Error deleting user', details: error.message });
  }
});

router.patch('/:id/password', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (!newPassword || newPassword.length < 4) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 4 characters.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password', details: error.message });
  }
});

module.exports = router;
