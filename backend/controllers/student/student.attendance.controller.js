// controllers/student/student.attendance.controller.js - MULTI-TENANT VERSION
import Attendance from '../../models/Attendance.js';
import Student from '../../models/Student.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { NotFoundError } from '../../utils/errors.js';

// Get my attendance - MULTI-TENANT
export const getMyAttendance = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { startDate, endDate, academicYear } = req.query;
  
  // ✅ MULTI-TENANT: Verify student belongs to school
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
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
  
  const attendanceRecords = await Attendance.find(filter)
    .populate('markedBy', 'name')
    .sort({ date: -1 });
  
  const myRecords = attendanceRecords.map(record => {
    const studentRecord = record.records.find(r => r.student.toString() === studentId);
    return {
      date: record.date,
      className: record.className,
      section: record.section,
      subject: record.subject,
      period: record.period,
      status: studentRecord ? studentRecord.status : 'ABSENT',
      remarks: studentRecord ? studentRecord.remarks : '',
      markedBy: record.markedByName
    };
  });
  
  // Calculate summary
  let totalPresent = 0;
  let totalAbsent = 0;
  
  myRecords.forEach(record => {
    if (record.status === 'PRESENT') totalPresent++;
    else if (record.status === 'ABSENT') totalAbsent++;
  });
  
  const totalClasses = myRecords.length;
  const attendancePercentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100).toFixed(2) : 0;
  
  return successResponse(res, 'Attendance retrieved successfully', {
    records: myRecords,
    summary: {
      totalClasses,
      totalPresent,
      totalAbsent,
      attendancePercentage: Number(attendancePercentage)
    }
  });
});

// Get attendance by subject - MULTI-TENANT
export const getAttendanceBySubject = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const academicYear = req.query.academicYear || getCurrentAcademicYear();
  
  // ✅ MULTI-TENANT: Verify student belongs to school
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const attendanceRecords = await Attendance.find({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    'records.student': studentId,
    academicYear
  });
  
  const subjectWiseAttendance = {};
  
  attendanceRecords.forEach(record => {
    const subject = record.subject || 'General';
    const studentRecord = record.records.find(r => r.student.toString() === studentId);
    
    if (!subjectWiseAttendance[subject]) {
      subjectWiseAttendance[subject] = {
        subject,
        totalClasses: 0,
        totalPresent: 0,
        totalAbsent: 0
      };
    }
    
    subjectWiseAttendance[subject].totalClasses++;
    
    if (studentRecord) {
      if (studentRecord.status === 'PRESENT') {
        subjectWiseAttendance[subject].totalPresent++;
      } else if (studentRecord.status === 'ABSENT') {
        subjectWiseAttendance[subject].totalAbsent++;
      }
    } else {
      subjectWiseAttendance[subject].totalAbsent++;
    }
  });
  
  // Calculate percentages
  Object.keys(subjectWiseAttendance).forEach(subject => {
    const data = subjectWiseAttendance[subject];
    data.attendancePercentage = data.totalClasses > 0 
      ? Number(((data.totalPresent / data.totalClasses) * 100).toFixed(2))
      : 0;
  });
  
  return successResponse(res, 'Subject-wise attendance retrieved successfully', 
    Object.values(subjectWiseAttendance)
  );
});

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export default {
  getMyAttendance,
  getAttendanceBySubject
};
