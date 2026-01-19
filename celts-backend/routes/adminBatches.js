const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const mongoose = require('mongoose'); 
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { paginate } = require("../utils/pagination");

router.get('/', protect, restrictTo(['admin']), async (req, res) => {
  try {
    if (req.query.all === 'true') {
      const batches = await Batch.find({})
        .populate({ path: "faculty", select: "name email systemId" })
        .populate({ path: "students", select: "name email systemId" })
        .sort({ createdAt: -1 })
        .lean();

      const mapped = batches.map(b => ({
        _id: b._id,
        name: b.name,
        program: b.program,
        year: b.year,
        section: b.section,
        createdAt: b.createdAt,
        faculty: Array.isArray(b.faculty)
          ? b.faculty.map(f => f?.name || f?.email || String(f?._id))
          : [],
        students: Array.isArray(b.students)
          ? b.students.map(s => s?.name || s?.email || String(s?._id))
          : []
      }));

      return res.json({ data: mapped, total: mapped.length });
    }

    // Default: paginated response
    const result = await paginate(req, Batch, {
      populate: [
        { path: "faculty", select: "name email systemId" },
        { path: "students", select: "name email systemId" }
      ],
      sort: { createdAt: -1 },
      map: (b) => ({
        _id: b._id,
        name: b.name,
        program: b.program,
        year: b.year,
        section: b.section,
        createdAt: b.createdAt,
        faculty: Array.isArray(b.faculty)
          ? b.faculty.map(f => f?.name || f?.email || String(f?._id))
          : [],
        students: Array.isArray(b.students)
          ? b.students.map(s => s?.name || s?.email || String(s?._id))
          : []
      })
    });

    res.json(result);
  } catch (err) {
    console.error("Error fetching batches:", err);
    res.status(500).json({ message: "Server error fetching batches" });
  }
});

router.post('/', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { name, program, year, section } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Batch name is required' });

    const newBatch = await Batch.create({
      name: name.trim(),
      program,
      year,
      section,
      createdBy: req.user?._id
    });

    const populated = await Batch.findById(newBatch._id)
      .populate({ path: 'faculty', select: 'name email' })
      .populate({ path: 'students', select: 'name email' })
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    console.error('Error creating batch:', err);
    res.status(500).json({ message: 'Server error creating batch' });
  }
});

router.put('/:id', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, program, year, section } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const updated = await Batch.findByIdAndUpdate(
      id,
      { name, program, year, section },
      { new: true, runValidators: true }
    )
      .populate({ path: 'faculty', select: 'name email systemId' })
      .populate({ path: 'students', select: 'name email systemId' });

    if (!updated) return res.status(404).json({ message: 'Batch not found' });

    res.json(updated);
  } catch (err) {
    console.error('Error updating batch:', err);
    res.status(500).json({ message: 'Server error updating batch' });
  }
});

router.delete('/:id', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }
    
    const deleted = await Batch.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Batch not found' });
    res.json({ message: 'Batch deleted successfully' });
  } catch (err) {
    console.error('Error deleting batch:', err);
    res.status(500).json({ message: 'Server error deleting batch' });
  }
});

router.post('/:batchId/assign-faculty/:facultyId', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { batchId, facultyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(batchId) || !mongoose.Types.ObjectId.isValid(facultyId)) {
      return res.status(400).json({ message: 'Invalid batch or faculty id' });
    }

    const faculty = await User.findById(facultyId);
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });
    if (faculty.role !== 'faculty') return res.status(400).json({ message: 'User is not a faculty' });

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    //Only one faculty allowed — replace existing
    batch.faculty = [facultyId];
    await batch.save();

    const populated = await Batch.findById(batch._id)
      .populate({ path: 'faculty', select: 'name email systemId' })
      .populate({ path: 'students', select: 'name email systemId' })
      .lean();

    res.json({ message: 'Faculty assigned successfully', batch: populated });
  } catch (err) {
    console.error('Error assigning faculty:', err);
    res.status(500).json({ message: 'Server error assigning faculty' });
  }
});



// POST /api/admin/batches/:batchId/assign-students-bulk
// Body: { studentIds: string[] }
router.post(
  '/:batchId/assign-students-bulk',
  protect,
  restrictTo(['admin']),
  async (req, res) => {
    try {
      const { batchId } = req.params;
      const { studentIds } = req.body;

      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ message: 'Invalid batchId' });
      }

      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res
          .status(400)
          .json({ message: 'studentIds must be a non-empty array' });
      }

      const validStudentIds = studentIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      if (validStudentIds.length === 0) {
        return res
          .status(400)
          .json({ message: 'No valid student ids provided' });
      }

      // ensure they are actual student users
      const students = await User.find({
        _id: { $in: validStudentIds },
        role: 'student',
      })
        .select('_id name systemId')
        .lean();

      if (students.length === 0) {
        return res
          .status(400)
          .json({ message: 'No valid student accounts found for given ids' });
      }

      const batch = await Batch.findById(batchId);
      if (!batch) {
        return res.status(404).json({ message: 'Batch not found' });
      }

      if (!Array.isArray(batch.students)) {
        batch.students = [];
      }

      const existing = new Set(
        batch.students.map((s) => String(s))
      );

      for (const s of students) {
        const sid = String(s._id);
        if (!existing.has(sid)) {
          batch.students.push(s._id);
          existing.add(sid);
        }
      }

      await batch.save();

      const populated = await Batch.findById(batchId)
        .populate('students', 'name email systemId')
        .populate('faculty', 'name email systemId')
        .lean();

      return res.json({
        message: `Assigned ${students.length} student(s) to batch.`,
        batch: populated,
      });
    } catch (err) {
      console.error('[Bulk assign students] error:', err);
      return res
        .status(500)
        .json({ message: 'Server error assigning students in bulk' });
    }
  }
);




// DELETE /api/admin/batches/:batchId/unassign-student/:studentId
router.delete('/:batchId/unassign-student/:studentId', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { batchId, studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(batchId) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid batch or student id' });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    const beforeCount = batch.students.length;
    batch.students = batch.students.filter(sid => String(sid) !== String(studentId));
    if (batch.students.length === beforeCount) {
      return res.status(400).json({ message: 'Student not found in this batch' });
    }

    await batch.save();

    const populated = await Batch.findById(batch._id)
      .populate({ path: 'faculty', select: 'name email systemId' })
      .populate({ path: 'students', select: 'name email systemId' })
      .lean();

    res.json({ message: 'Student removed from batch', batch: populated });
  } catch (err) {
    console.error('Error unassigning student:', err);
    res.status(500).json({ message: 'Server error unassigning student' });
  }
});

// GET /api/admin/batches/:id  -> returns full populated objects (with _id)
router.get('/:id', protect, restrictTo(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const batch = await Batch.findById(id)
      .populate({ path: 'faculty', select: '_id name email systemId' })
      .lean();

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    //paginate ONLY students
    const studentsResult = await paginate(req, User, {
      filter: {
        _id: { $in: batch.students || [] },
        role: 'student',
      },
      select: '_id name email systemId',
      sort: { name: 1 },
    });

    return res.json({
      _id: batch._id,
      name: batch.name,
      program: batch.program,
      year: batch.year,
      section: batch.section,
      createdAt: batch.createdAt,
      faculty: Array.isArray(batch.faculty)
        ? batch.faculty.map(f => ({
            _id: f._id,
            name: f.name,
            email: f.email,
            systemId: f.systemId
          }))
        : [],
      students: studentsResult.data,

      studentsPagination: {
        page: studentsResult.page,
        limit: studentsResult.limit,
        total: studentsResult.total,
        hasNext: studentsResult.hasNext,
      },
    });
  } catch (err) {
    console.error('Error fetching batch detail:', err);
    res.status(500).json({ message: 'Server error fetching batch detail' });
  }
});

module.exports = router;
