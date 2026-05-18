// controllers/admin/admin.student.management.controller.js - MULTI-TENANT VERSION
import Student from '../../models/Student.js';
import Class from '../../models/Class.js';
import Result from '../../models/Result.js';
import Enrollment from '../../models/Enrollment.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { getPaginationParams } from '../../utils/pagination.js';

// Helper to find class by name/numeric
async function findClassByName(className, academicYear, schoolId) {
  let classDoc = await Class.findOne({ className, academicYear, schoolId });
  if (!classDoc) {
    classDoc = await Class.findOne({ className: `Class ${className}`, academicYear, schoolId });
  }
  if (!classDoc) {
    const num = parseInt(className);
    if (!isNaN(num)) {
      classDoc = await Class.findOne({ classNumeric: num, academicYear, schoolId });
    }
  }
  return classDoc;
}

// Get students with advanced management filters - MULTI-TENANT
export const getStudentsManagement = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { 
    className, section, academicYear, status, 
    search, hasEmail, hasSection, sortBy 
  } = req.query;
  
  let studentFilter = { schoolId: req.schoolId };
  if (status) studentFilter.status = status;
  
  if (hasEmail === 'true') {
    studentFilter.email = { $exists: true, $nin: [null, ''] };
  } else if (hasEmail === 'false') {
    studentFilter.$or = [
      { email: { $exists: false } },
      { email: null },
      { email: '' }
    ];
  }
  
  if (search) {
    studentFilter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { studentID: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { fatherName: { $regex: search, $options: 'i' } },
      { motherName: { $regex: search, $options: 'i' } }
    ];
  }

  let studentIds = null;
  if (status || search || hasEmail !== undefined) {
    const matchedStudents = await Student.find(studentFilter).select('_id');
    studentIds = matchedStudents.map(s => s._id);
  }

  const enrollFilter = { schoolId: req.schoolId, status: { $ne: 'DROPPED' } };
  if (academicYear) enrollFilter.academicYear = academicYear;
  if (section) enrollFilter.section = section;
  if (studentIds !== null) enrollFilter.student = { $in: studentIds };

  if (className) {
    const classDoc = await Class.findOne({
      schoolId: req.schoolId,
      academicYear,
      $or: [
        { className: className },
        { className: `Class ${className}` }
      ]
    });

    if (classDoc) {
      enrollFilter.class = classDoc._id;
    } else {
      return res.status(200).json({
        success: true,
        message: "No students found",
        students: [],
        pagination: {
          currentPage: parseInt(page),
          perPage: parseInt(limit),
          total: 0,
          totalPages: 0
        }
      });
    }
  }
  
  if (hasSection === 'true') {
    enrollFilter.section = { $exists: true, $nin: [null, ''] };
  } else if (hasSection === 'false') {
    enrollFilter.$or = [
      { section: { $exists: false } },
      { section: null },
      { section: '' }
    ];
  }
  
  // Sorting
  let sort = { createdAt: -1 };
  // If sorting by name, it will just default to createdAt since name is populated, 
  // but let's sort by rollNumber generally for Roster.
  if (sortBy === 'rollNumber') sort = { rollNumber: 1 };
  else if (sortBy === 'className') sort = { className: 1, section: 1, rollNumber: 1 };
  
  const [enrollmentsRaw, total] = await Promise.all([
    Enrollment.find(enrollFilter)
      .populate('student', '-password')
      .populate('class', 'className sections')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Enrollment.countDocuments(enrollFilter)
  ]);

  const studentsRaw = enrollmentsRaw.map(e => {
    if (!e.student) return null;
    return {
      ...e.student,
      class: e.class,
      className: e.className,
      section: e.section,
      rollNumber: e.rollNumber,
      academicYear: e.academicYear,
      enrollmentId: e._id
    };
  }).filter(Boolean);
  
  // 🔥 CORE LOGIC: Link FINAL Result with each student
  const students = await Promise.all(studentsRaw.map(async (student) => {
    const finalResult = await Result.findOne({
      student: student._id,
      schoolId: req.schoolId,
      academicYear: student.academicYear,
      examType: 'FINAL' // 🎯 Sirf final exam check karega
    }).select('result overallPercentage overallGrade isPublished');

    return {
      ...student,
      finalResult: finalResult || null // Frontend isse badge dikhayega
    };
  }));
  
  // ✅ FIX: Return structure matching frontend expectations (students & pagination at root)
  return res.status(200).json({
    success: true,
    message: 'Students fetched',
    students,
    pagination: {
      currentPage: parseInt(page),
      perPage: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});
// export const getStudentsManagement = async (req, res) => {
//   try {
//     const { className, academicYear, page = 1, limit = 10 } = req.query;

//     let filter = { schoolId: req.schoolId };

//     // 🔥 YAHAN replace karo
//     if (className) {
//       const classDoc = await findClassByName(
//         className,
//         academicYear,
//         req.schoolId
//       );

//       if (classDoc) {
//         filter.class = classDoc._id;   // ✅ correct filtering
//       } else {
//         return res.status(200).json({
//           success: true,
//           message: "No students found",
//           students: [],
//           pagination: {
//             currentPage: parseInt(page),
//             perPage: parseInt(limit),
//             total: 0,
//             totalPages: 0
//           }
//         });
//       }
//     }

//     const students = await Student.find(filter);

//     res.status(200).json({ success: true, students });

//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// Get student statistics - MULTI-TENANT
export const getStudentStatistics = asyncHandler(async (req, res) => {
  const { academicYear, className } = req.query;
  
  const enrollFilter = { schoolId: req.schoolId, status: { $ne: 'DROPPED' } };
  if (academicYear) enrollFilter.academicYear = academicYear;
  if (className) enrollFilter.className = className;
  
  const enrollments = await Enrollment.find(enrollFilter).populate('student', 'status gender').lean();

  let totalStudents = enrollments.length;
  let enrolledStudents = 0;
  let suspendedStudents = 0;
  let withdrawnStudents = 0;
  let graduatedStudents = 0;

  const classCountMap = {};
  const genderCountMap = {};

  enrollments.forEach(e => {
     const st = e.student;
     if (!st) return;

     if (st.status === 'ACTIVE') enrolledStudents++;
     else if (st.status === 'WITHDRAWN') withdrawnStudents++;
     else if (st.status === 'ALUMNI') graduatedStudents++;

     const classKey = `${e.className}_${e.section}`;
     if (!classCountMap[classKey]) classCountMap[classKey] = { className: e.className, section: e.section, count: 0 };
     classCountMap[classKey].count++;

     const gender = st.gender || 'Unknown';
     genderCountMap[gender] = (genderCountMap[gender] || 0) + 1;
  });
  
  const statistics = {
    total: totalStudents,
    byStatus: {
      enrolled: enrolledStudents,
      suspended: suspendedStudents,
      withdrawn: withdrawnStudents,
      graduated: graduatedStudents,
      pending: totalStudents - (enrolledStudents + suspendedStudents + withdrawnStudents + graduatedStudents)
    },
    byClass: Object.values(classCountMap).sort((a, b) => a.className.localeCompare(b.className) || a.section.localeCompare(b.section)),
    byGender: genderCountMap
  };
  
  return successResponse(res, 'Student statistics retrieved successfully', statistics);
});

// Bulk update student status - MULTI-TENANT
export const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { studentIds, status } = req.body;
  
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ValidationError('Student IDs array is required');
  }
  
  if (!['APPLICANT', 'ADMITTED', 'ACTIVE', 'ALUMNI', 'WITHDRAWN'].includes(status)) {
    throw new ValidationError('Invalid status. Expected APPLICANT, ADMITTED, ACTIVE, ALUMNI, or WITHDRAWN.');
  }
  
  const result = await Student.updateMany(
    { 
      _id: { $in: studentIds },
      schoolId: req.schoolId
    },
    { status }
  );
  
  return successResponse(res, `Status updated for ${result.modifiedCount} students`, {
    updatedCount: result.modifiedCount,
    status
  });
});

// Promote students to next class - MULTI-TENANT
export const promoteStudents = asyncHandler(async (req, res) => {
  let { 
    studentIds, 
    sourceClassId, 
    targetClassId, 
    targetSection, 
    targetAcademicYear,
    newClassName,    // From frontend
    newAcademicYear  // From frontend
  } = req.body;
  
  // Handle frontend payload format
  if (newAcademicYear) targetAcademicYear = newAcademicYear;
  
  // If targetClassId is missing, try to find it using newClassName
  if (!targetClassId && newClassName) {
    const classDoc = await findClassByName(newClassName, targetAcademicYear, req.schoolId);
    if (classDoc) {
      targetClassId = classDoc._id;
    } else {
      throw new ValidationError(`Target class "${newClassName}" not found for academic year ${targetAcademicYear}`);
    }
  }
  
  if (!targetClassId || !targetAcademicYear) {
    throw new ValidationError('Target class and academic year are required');
  }
  
  const targetClass = await Class.findOne({ _id: targetClassId, schoolId: req.schoolId });
  if (!targetClass) {
    throw new NotFoundError('Target class');
  }
  
  let studentsToPromote = studentIds;
  
  if (!studentsToPromote || studentsToPromote.length === 0) {
    if (sourceClassId) {
      const sourceEnrollments = await Enrollment.find({ schoolId: req.schoolId, class: sourceClassId, status: 'ACTIVE' }).select('student').lean();
      studentsToPromote = sourceEnrollments.map(e => e.student);
    } else {
    throw new ValidationError('Either studentIds or sourceClassId is required');
    }
  }
  
  if (!studentsToPromote || studentsToPromote.length === 0) {
    throw new ValidationError('No students found to promote');
  }
  
  await Student.updateMany(
    { _id: { $in: studentsToPromote }, schoolId: req.schoolId },
    { status: 'ACTIVE' }
  );

  await Enrollment.updateMany(
    { student: { $in: studentsToPromote }, schoolId: req.schoolId, status: 'ACTIVE' },
    { status: 'PROMOTED' }
  );
  
  const lastEnrollment = await Enrollment.findOne({
    schoolId: req.schoolId, class: targetClassId, section: targetSection, academicYear: targetAcademicYear
  }).sort({ rollNumber: -1 }).lean();
  
  let nextRollNumber = lastEnrollment && lastEnrollment.rollNumber ? lastEnrollment.rollNumber + 1 : 1;
  
  if (targetSection) {
    // Update target section strength
    const targetSectionData = targetClass.sections.find(s => s.sectionName === targetSection);
    if (targetSectionData) {
      targetSectionData.currentStrength += studentsToPromote.length;
      await targetClass.save();
    }
  }
  
  const enrollmentDocs = studentsToPromote.map(studentId => {
    const doc = {
      schoolId: req.schoolId,
      student: studentId,
      class: targetClassId,
      className: targetClass.className,
      section: targetSection,
      academicYear: targetAcademicYear,
      rollNumber: nextRollNumber++,
      status: 'ACTIVE'
    }
    return doc;
  });
  
  await Enrollment.insertMany(enrollmentDocs);
  
  return successResponse(res, `Successfully promoted ${studentsToPromote.length} students`, {
    promotedCount: studentsToPromote.length,
    targetClass: targetClass.className,
    targetSection: targetSection || 'Not assigned',
    academicYear: targetAcademicYear
  });
});

// Bulk delete students - MULTI-TENANT
export const bulkDeleteStudents = asyncHandler(async (req, res) => {
  const { studentIds } = req.body;
  
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ValidationError('Student IDs array is required');
  }
  
  // Delete students
  await Enrollment.updateMany(
    { student: { $in: studentIds }, schoolId: req.schoolId },
    { status: 'DROPPED' }
  );
  
  const result = await Student.updateMany(
    { _id: { $in: studentIds }, schoolId: req.schoolId },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
  
  return successResponse(res, `Successfully deleted ${result.modifiedCount} students`, {
    deletedCount: result.modifiedCount
  });
});

// Transfer students between sections - MULTI-TENANT
export const transferStudents = asyncHandler(async (req, res) => {
  const { studentIds, targetClassId, targetSection } = req.body;
  
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ValidationError('Student IDs array is required');
  }
  
  if (!targetClassId || !targetSection) {
    throw new ValidationError('Target class and section are required');
  }
  
  const targetClass = await Class.findOne({ _id: targetClassId, schoolId: req.schoolId });
  if (!targetClass) {
    throw new NotFoundError('Target class');
  }
  
  const targetSectionData = targetClass.sections.find(s => s.sectionName === targetSection);
  if (!targetSectionData) {
    throw new NotFoundError('Target section');
  }
  
  // Check capacity
  const availableSeats = targetSectionData.capacity - targetSectionData.currentStrength;
  if (studentIds.length > availableSeats) {
    throw new ValidationError(`Only ${availableSeats} seats available in target section`);
  }
  
  // Transfer students
  await Enrollment.updateMany(
    { student: { $in: studentIds }, schoolId: req.schoolId, status: 'ACTIVE' },
    {
      class: targetClassId,
      className: targetClass.className,
      section: targetSection
    }
  );
  
  const result = await Student.updateMany(
    { _id: { $in: studentIds }, schoolId: req.schoolId },
    {
      status: 'ACTIVE'
    }
  );
  
  // Update target section strength
  targetSectionData.currentStrength += studentIds.length;
  await targetClass.save();
  
  return successResponse(res, `Successfully transferred ${result.modifiedCount} students`, {
    transferredCount: result.modifiedCount,
    targetClass: targetClass.className,
    targetSection
  });
});


export default {
  getStudentsManagement,
  getStudentStatistics,
  bulkUpdateStatus,
  promoteStudents,
  bulkDeleteStudents,
  transferStudents
};
