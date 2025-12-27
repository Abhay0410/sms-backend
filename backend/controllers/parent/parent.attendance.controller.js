// controllers/parent/parent.attendance.controller.js - MULTI-TENANT
import Parent from '../../models/Parent.js';
import Attendance from '../../models/Attendance.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// Get child attendance - MULTI-TENANT
export const getChildAttendance = asyncHandler(async (req, res) => {
  const parentId = req.user.id;
  const { childId } = req.params;
  const { startDate, endDate, academicYear } = req.query;
  
  // ✅ MULTI-TENANT: Verify parent + child belong to school
  const parent = await Parent.findOne({
    _id: parentId,
    schoolId: req.schoolId  // ✅ School verification
  }).populate('children', 'name studentID class section');
  
  if (!parent) {
    throw new NotFoundError('Parent');
  }
  
  // Verify child belongs to parent
  const child = parent.children.find(c => c._id.toString() === childId);
  if (!child) {
    throw new ValidationError('This child does not belong to you');
  }
  
  const filter = {
    schoolId: req.schoolId,  // ✅ MULTI-TENANT FILTER
    'records.student': childId,
    academicYear: academicYear || getCurrentAcademicYear()
  };
  
  if (startDate && endDate) {
    filter.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const [attendanceRecords, totalRecords] = await Promise.all([
    Attendance.find(filter)
      .populate('markedBy', 'name teacherID')
      .sort({ date: -1 }),
    Attendance.countDocuments(filter)
  ]);
  
  const childRecords = attendanceRecords.map((record) => {
    const studentRecord = record.records.find(
      (r) => r.student.toString() === childId
    );
    
    return {
      date: record.date,
      className: record.className,
      section: record.section,
      subject: record.subject,
      period: record.period,
      status: studentRecord ? studentRecord.status : "ABSENT",
      remarks: studentRecord ? studentRecord.remarks : "",
      markedBy: record.markedBy ? {
        name: record.markedBy.name,
        teacherID: record.markedBy.teacherID || "",
      } : null,
    };
  });
  
  // Calculate summary
  let totalPresent = 0;
  let totalAbsent = 0;
  
  childRecords.forEach(record => {
    if (record.status === 'PRESENT') totalPresent++;
    else if (record.status === 'ABSENT') totalAbsent++;
  });
  
  const totalClasses = childRecords.length;
  const attendancePercentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100).toFixed(2) : 0;
  
  return successResponse(res, 'Child attendance retrieved successfully', {
    child: {
      name: child.name,
      studentID: child.studentID,
      className: child.className,
      section: child.section
    },
    records: childRecords,
    summary: {
      totalClasses,
      totalPresent,
      totalAbsent,
      attendancePercentage: Number(attendancePercentage)
    },
    filters: {
      academicYear: academicYear || getCurrentAcademicYear(),
      dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'All',
      totalRecords
    }
  });
});

export default {
  getChildAttendance
};
