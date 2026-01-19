// routes/adminAssignments.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { paginate } = require('../utils/pagination');

function removeStudentIdFromArray(arr, studentId) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(id => id.toString() !== studentId.toString());
}

function isValidId(id) { 
  return mongoose.Types.ObjectId.isValid(id); 
}

router.post('/faculty-batch', protect, restrictTo(['admin']), async (req, res) => {
  const { facultyId, cohort } = req.body;
  if (!facultyId || !cohort) return res.status(400).json({ message: 'facultyId and cohort required' });
  if (!isValidId(facultyId)) return res.status(400).json({ message: 'invalid facultyId' });
  try {
    const faculty = await User.findById(facultyId);
    if (!faculty || faculty.role !== 'faculty') return res.status(404).json({ message: 'Faculty not found' });
    faculty.cohort = cohort; await faculty.save();
    return res.json({ message: 'cohort assigned', faculty: faculty.toJSON() });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});


router.post('/unassign-student', protect, restrictTo(['admin']), async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'studentId required' });
  if (!isValidId(studentId)) return res.status(400).json({ message: 'invalid id' });
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const student = await User.findById(studentId).session(session);
    if (!student || student.role !== 'student') { await session.abortTransaction(); session.endSession(); return res.status(404).json({message:'Student not found'}); }
    const oldFacultyId = student.assignedFaculty ? student.assignedFaculty.toString() : null;
    student.assignedFaculty = undefined; await student.save({ session });
    if (oldFacultyId) {
      const oldFaculty = await User.findById(oldFacultyId).session(session);
      if (oldFaculty) { oldFaculty.students = removeStudentIdFromArray(oldFaculty.students, student._id); await oldFaculty.save({ session }); }
    }
    await session.commitTransaction(); session.endSession();
    const updatedStudent = await User.findById(student._id).select('-password');
    return res.json({ message: 'unassigned', student: updatedStudent });
  } catch (err) {
    await session.abortTransaction().catch(()=>{}); session.endSession();
    // fallback
    try {
      const student = await User.findById(studentId);
      if (!student || student.role !== 'student') return res.status(404).json({ message: 'Student not found' });
      const oldFacultyId = student.assignedFaculty ? student.assignedFaculty.toString() : null;
      student.assignedFaculty = undefined; await student.save();
      if (oldFacultyId) {
        const oldFaculty = await User.findById(oldFacultyId);
        if (oldFaculty) { oldFaculty.students = removeStudentIdFromArray(oldFaculty.students, student._id); await oldFaculty.save(); }
      }
      const updatedStudent = await User.findById(student._id).select('-password');
      return res.json({ message: 'unassigned (fallback)', student: updatedStudent });
    } catch (err2) {
      return res.status(500).json({ message: 'unassign failed', details: err2.message });
    }
  }
});

router.get('/faculty/:facultyId/students', protect, restrictTo(['admin','faculty']), async (req, res) => {
  const facultyId = req.params.facultyId;
  if (!isValidId(facultyId)) return res.status(400).json({ message: 'invalid id' });
  try {
    // const faculty = await User.findById(facultyId).select('-password').populate('students','name email cohort');
    const faculty = await User.findById(facultyId) .select('_id name cohort role students').lean();

    if (!faculty || faculty.role !== 'faculty') return res.status(404).json({ message: 'Faculty not found' });
    if (req.user.role === 'faculty' && req.user._id.toString() !== facultyId) return res.status(403).json({ message: 'Forbidden' });
    
    //paginate students
      const studentsResult = await paginate(req, User, {
        filter: {
          _id: { $in: faculty.students || [] },
          role: 'student',
        },
        select: 'name email cohort',
        sort: { name: 1 },
      });


    return res.json({ faculty: { id: faculty._id, name: faculty.name, cohort: faculty.cohort }, students: studentsResult.data,

        // pagination metadata (non-breaking)
        studentsPagination: {
          page: studentsResult.page,
          limit: studentsResult.limit,
          total: studentsResult.total,
          totalPages: studentsResult.totalPages,
          hasNext: studentsResult.hasNext,
          hasPrev: studentsResult.hasPrev,
        },
      });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
