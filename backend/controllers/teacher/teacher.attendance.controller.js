// controllers/teacher/teacher.attendance.controller.js - MULTI-TENANT VERSION
import Attendance from '../../models/Attendance.js';
import Class from '../../models/Class.js';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// Mark attendance - MULTI-TENANT
export const markAttendance = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const {
    date,
    classId,
    sectionId,
    subject,
    period,
    attendance,
    academicYear,
  } = req.body;

  if (!date || !classId || !sectionId || !attendance || !academicYear) {
    throw new ValidationError(
      'Date, class, section, attendance, and academic year are required'
    );
  }

  const records = attendance.map((item) => ({
    student: item.studentId,
    status: item.status,
    remarks: item.remarks || '',
  }));

  // Recalculate totals
  let totalPresent = 0;
  let totalAbsent = 0;
  records.forEach((record) => {
    if (record.status === 'PRESENT') totalPresent++;
    else if (record.status === 'ABSENT') totalAbsent++;
  });
  const totalStudents = records.length;

  // ✅ MULTI-TENANT: Check if attendance already exists
  const existing = await Attendance.findOne({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    class: classId,
    section: sectionId,
    date: new Date(date),
    period,
    academicYear,
  });

  if (existing) {
    if (existing.markedBy && existing.markedBy.toString() !== teacherId.toString()) {
      throw new ValidationError(
        'Attendance for this period has already been marked by another teacher'
      );
    }
    existing.records = records;
    existing.totalPresent = totalPresent;
    existing.totalAbsent = totalAbsent;
    existing.totalStudents = totalStudents;
    existing.subject = subject || existing.subject;
    existing.markedBy = teacherId;
    await existing.save();
    return successResponse(res, 'Attendance updated successfully', existing);
  }

  // Create new attendance record
  const newAttendance = await Attendance.create({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    date: new Date(date),
    class: classId,
    section: sectionId,
    subject,
    period,
    records,
    totalPresent,
    totalAbsent,
    totalStudents,
    markedBy: teacherId,
    academicYear,
  });

  return successResponse(res, 'Attendance marked successfully', newAttendance);
});

// Get attendance by class - MULTI-TENANT
export const getAttendanceByClass = asyncHandler(async (req, res) => {
  const { classId, section, sectionId, date, academicYear } = req.query;

  const sectionValue = sectionId || section; 

  if (!classId || !sectionValue) {
    throw new ValidationError('Class and section are required');
  }

  const filter = { 
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    class: classId, 
    section: sectionValue 
  };
  if (date) filter.date = new Date(date);
  if (academicYear) filter.academicYear = academicYear;

  const attendance = await Attendance.find(filter)
    .populate('markedBy', 'name teacherID')
    .sort({ date: -1 });

  return successResponse(res, 'Attendance retrieved successfully', attendance);
});

// Get attendance by date - MULTI-TENANT
export const getAttendanceByDate = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const { date } = req.query;
  
  if (!date) {
    throw new ValidationError('Date is required');
  }
  
  const attendance = await Attendance.find({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    date: new Date(date),
    markedBy: teacherId
  })
    .populate('class', 'className')
    .sort({ period: 1 });
  
  return successResponse(res, 'Attendance retrieved successfully', attendance);
});

// Update attendance - MULTI-TENANT
export const updateAttendance = asyncHandler(async (req, res) => {
  const { attendanceId } = req.params;
  const { records } = req.body;
  
  const attendance = await Attendance.findOne({
    _id: attendanceId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!attendance) {
    throw new NotFoundError('Attendance');
  }
  
  if (attendance.markedBy.toString() !== req.user.id) {
    throw new ForbiddenError('You can only update your own attendance records');
  }
  
  // Recalculate totals
  let totalPresent = 0;
  let totalAbsent = 0;
  
  records.forEach(record => {
    if (record.status === 'PRESENT') totalPresent++;
    else if (record.status === 'ABSENT') totalAbsent++;
  });
  
  attendance.records = records;
  attendance.totalPresent = totalPresent;
  attendance.totalAbsent = totalAbsent;
  
  await attendance.save();
  
  return successResponse(res, 'Attendance updated successfully', attendance);
});

// Get student attendance summary - MULTI-TENANT
export const getStudentAttendanceSummary = asyncHandler(async (req, res) => {
  const { studentId, startDate, endDate, academicYear } = req.query;
  
  if (!studentId) {
    throw new ValidationError('Student ID is required');
  }
  
  const filter = {
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    'records.student': studentId,
    academicYear: academicYear || getCurrentAcademicYear()
  };
  
  if (startDate && endDate) {
    filter.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const attendanceRecords = await Attendance.find(filter);
  
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalClasses = 0;
  
  attendanceRecords.forEach(record => {
    const studentRecord = record.records.find(r => r.student.toString() === studentId);
    if (studentRecord) {
      totalClasses++;
      if (studentRecord.status === 'PRESENT') totalPresent++;
      else if (studentRecord.status === 'ABSENT') totalAbsent++;
    }
  });
  
  const attendancePercentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100).toFixed(2) : 0;
  
  return successResponse(res, 'Student attendance summary retrieved', {
    totalClasses,
    totalPresent,
    totalAbsent,
    attendancePercentage: Number(attendancePercentage)
  });
});

// Get teacher classes - MULTI-TENANT
export const getTeacherClasses = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const academicYear = req.query.academicYear || getCurrentAcademicYear();

  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId
  });

  if (!teacher) {
    throw new NotFoundError('Teacher');
  }

  const classes = await Class.find({
    schoolId: req.schoolId,
    academicYear,
    'sections.classTeacher': teacherId,
  })
    .select('className academicYear sections')
    .lean();

  const assignedClasses = [];

  classes.forEach(cls => {
    cls.sections.forEach(sec => {
      if (sec.classTeacher?.toString() === teacherId.toString()) {
        assignedClasses.push({
          classId: cls._id.toString(),
          className: cls.className,
          section: sec.sectionName,
          sectionId: sec._id.toString(),
          academicYear: cls.academicYear,
        });
      }
    });
  });

  const canMarkAttendance = assignedClasses.length > 0;

  return successResponse(res, 'Teacher assignments retrieved', {
    teacher: { id: teacherId, name: teacher.name },
    classes: assignedClasses,
    teachingSubjects: [],
    canMarkAttendance,
    roles: {
      isClassTeacher: canMarkAttendance,
      isSubjectTeacher: false,
    },
  });
});


// Get class students - MULTI-TENANT
export const getClassStudents = asyncHandler(async (req, res) => {
  const { classId, sectionId, academicYear } = req.query;

  if (!classId || !sectionId) {
    throw new ValidationError('Class and section are required');
  }

  // ✅ MULTI-TENANT: Verify class exists in school
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    academicYear: academicYear || getCurrentAcademicYear(),
  }).lean();

  if (!classData) {
    throw new NotFoundError('Class');
  }

  const section = classData.sections.find(
    (sec) => sec._id.toString() === sectionId.toString()
  );

  if (!section) {
    throw new NotFoundError('Section');
  }

  // ✅ MULTI-TENANT: Get students from same school
  const students = await Student.find({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    class: classId,
    section: section.sectionName,
    academicYear: classData.academicYear,
    status: { $in: ['ENROLLED', 'REGISTERED'] }
  })
    .select('name studentID rollNumber')
    .sort({ rollNumber: 1, name: 1 })
    .lean();

  const formatted = students.map((s) => ({
    studentId: s._id.toString(),
    studentID: s.studentID,
    name: s.name,
    rollNumber: s.rollNumber,
    status: 'PRESENT',
    remarks: '',
  }));

  return successResponse(res, 'Class students retrieved', {
    classId,
    sectionId,
    academicYear: classData.academicYear,
    students: formatted,
  });
});

export default {
  markAttendance,
  getAttendanceByClass,
  getAttendanceByDate,
  updateAttendance,
  getStudentAttendanceSummary,
  getTeacherClasses,
  getClassStudents,
};
