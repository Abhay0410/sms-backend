// controllers/admin/admin.student.management.controller.js - MULTI-TENANT VERSION
import Student from '../../models/Student.js';
import Class from '../../models/Class.js';
import Result from '../../models/Result.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
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
  
  const filter = {
    schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
  };
  
  // Basic filters
  if (className) filter.className = className;
  if (section) filter.section = section;
  if (academicYear) filter.academicYear = academicYear;
  if (status) filter.status = status;
  
  // Advanced filters
  if (hasEmail === 'true') {
    filter.email = { $exists: true, $ne: null, $ne: '' };
  } else if (hasEmail === 'false') {
    filter.$or = [
      { email: { $exists: false } },
      { email: null },
      { email: '' }
    ];
  }
  
  if (hasSection === 'true') {
    filter.section = { $exists: true, $ne: null, $ne: '' };
  } else if (hasSection === 'false') {
    filter.$or = [
      { section: { $exists: false } },
      { section: null },
      { section: '' }
    ];
  }
  
  // Search filter
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { studentID: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { fatherName: { $regex: search, $options: 'i' } },
      { motherName: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Sorting
  let sort = { createdAt: -1 };
  if (sortBy === 'name') sort = { name: 1 };
  else if (sortBy === 'rollNumber') sort = { rollNumber: 1 };
  else if (sortBy === 'admissionDate') sort = { admissionDate: -1 };
  else if (sortBy === 'className') sort = { className: 1, section: 1, rollNumber: 1 };
  
  const [studentsRaw, total] = await Promise.all([
    Student.find(filter)
      .populate('class', 'className sections')
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Student.countDocuments(filter)
  ]);
  
  // 🔥 CORE LOGIC: Link FINAL Result with each student
  const students = await Promise.all(studentsRaw.map(async (student) => {
    const finalResult = await Result.findOne({
      student: student._id,
      schoolId: req.schoolId,
      academicYear: student.academicYear,
      examType: 'FINAL' // 🎯 Sirf final exam check karega
    }).select('result overallPercentage overallGrade isPublished');

    return {
      ...student.toObject(),
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

// Get student statistics - MULTI-TENANT
export const getStudentStatistics = asyncHandler(async (req, res) => {
  const { academicYear, className } = req.query;
  
  const filter = { schoolId: req.schoolId };
  if (academicYear) filter.academicYear = academicYear;
  if (className) filter.className = className;
  
  const [
    totalStudents,
    enrolledStudents,
    suspendedStudents,
    withdrawnStudents,
    graduatedStudents,
    studentsByClass,
    studentsByGender
  ] = await Promise.all([
    Student.countDocuments(filter),
    Student.countDocuments({ ...filter, status: 'ENROLLED' }),
    Student.countDocuments({ ...filter, status: 'SUSPENDED' }),
    Student.countDocuments({ ...filter, status: 'WITHDRAWN' }),
    Student.countDocuments({ ...filter, status: 'GRADUATED' }),
    Student.aggregate([
      { $match: filter },
      { 
        $group: { 
          _id: { className: '$className', section: '$section' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.className': 1, '_id.section': 1 } }
    ]),
    Student.aggregate([
      { $match: filter },
      { 
        $group: { 
          _id: '$gender',
          count: { $sum: 1 }
        }
      }
    ])
  ]);
  
  const statistics = {
    total: totalStudents,
    byStatus: {
      enrolled: enrolledStudents,
      suspended: suspendedStudents,
      withdrawn: withdrawnStudents,
      graduated: graduatedStudents,
      pending: totalStudents - (enrolledStudents + suspendedStudents + withdrawnStudents + graduatedStudents)
    },
    byClass: studentsByClass.map(item => ({
      className: item._id.className,
      section: item._id.section,
      count: item.count
    })),
    byGender: studentsByGender.reduce((acc, item) => {
      acc[item._id || 'Unknown'] = item.count;
      return acc;
    }, {})
  };
  
  return successResponse(res, 'Student statistics retrieved successfully', statistics);
});

// Bulk update student status - MULTI-TENANT
export const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { studentIds, status } = req.body;
  
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ValidationError('Student IDs array is required');
  }
  
  if (!['ENROLLED', 'SUSPENDED', 'WITHDRAWN', 'GRADUATED', 'TRANSFERRED'].includes(status)) {
    throw new ValidationError('Invalid status');
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
  
  // Get students to promote
  const filter = { schoolId: req.schoolId };
  if (studentIds && studentIds.length > 0) {
    filter._id = { $in: studentIds };
  } else if (sourceClassId) {
    filter.class = sourceClassId;
  } else {
    throw new ValidationError('Either studentIds or sourceClassId is required');
  }
  
  const students = await Student.find(filter);
  
  if (students.length === 0) {
    throw new ValidationError('No students found to promote');
  }
  
  // Update source class section strengths
  if (sourceClassId) {
    const sourceClass = await Class.findOne({ _id: sourceClassId, schoolId: req.schoolId });
    if (sourceClass) {
      students.forEach(student => {
        if (student.section) {
          const section = sourceClass.sections.find(s => s.sectionName === student.section);
          if (section && section.currentStrength > 0) {
            section.currentStrength -= 1;
          }
        }
      });
      await sourceClass.save();
    }
  }
  
  // Promote students
  const promotionData = {
    class: targetClassId,
    className: targetClass.className,
    academicYear: targetAcademicYear
  };
  
  if (targetSection) {
    promotionData.section = targetSection;
    promotionData.status = 'ENROLLED';
    
    // Update target section strength
    const targetSectionData = targetClass.sections.find(s => s.sectionName === targetSection);
    if (targetSectionData) {
      targetSectionData.currentStrength += students.length;
      await targetClass.save();
    }
  } else {
    promotionData.section = '';
    promotionData.rollNumber = '';
    promotionData.status = 'REGISTERED';
  }
  
  const result = await Student.updateMany(
    { _id: { $in: students.map(s => s._id) }, schoolId: req.schoolId },
    promotionData
  );
  
  return successResponse(res, `Successfully promoted ${result.modifiedCount} students`, {
    promotedCount: result.modifiedCount,
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
  
  // Get students and update section strengths
  const students = await Student.find({ _id: { $in: studentIds }, schoolId: req.schoolId });
  
  // Update class section strengths
  const classUpdates = {};
  
  for (const student of students) {
    if (student.class && student.section) {
      const key = `${student.class}_${student.section}`;
      if (!classUpdates[key]) {
        classUpdates[key] = { classId: student.class, section: student.section, count: 0 };
      }
      classUpdates[key].count++;
    }
  }
  
  for (const key in classUpdates) {
    const { classId, section, count } = classUpdates[key];
    const classData = await Class.findOne({ _id: classId, schoolId: req.schoolId });
    if (classData) {
      const sectionData = classData.sections.find(s => s.sectionName === section);
      if (sectionData) {
        sectionData.currentStrength = Math.max(0, sectionData.currentStrength - count);
        await classData.save();
      }
    }
  }
  
  // Delete students
  const result = await Student.deleteMany({ _id: { $in: studentIds }, schoolId: req.schoolId });
  
  return successResponse(res, `Successfully deleted ${result.deletedCount} students`, {
    deletedCount: result.deletedCount
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
  
  const students = await Student.find({ _id: { $in: studentIds }, schoolId: req.schoolId });
  
  // Update source section strengths
  const sourceClassUpdates = {};
  
  students.forEach(student => {
    if (student.class && student.section) {
      const key = `${student.class}_${student.section}`;
      if (!sourceClassUpdates[key]) {
        sourceClassUpdates[key] = { classId: student.class, section: student.section, count: 0 };
      }
      sourceClassUpdates[key].count++;
    }
  });
  
  for (const key in sourceClassUpdates) {
    const { classId, section, count } = sourceClassUpdates[key];
    const classData = await Class.findOne({ _id: classId, schoolId: req.schoolId });
    if (classData) {
      const sectionData = classData.sections.find(s => s.sectionName === section);
      if (sectionData && sectionData.currentStrength > 0) {
        sectionData.currentStrength -= count;
        await classData.save();
      }
    }
  }
  
  // Transfer students
  const result = await Student.updateMany(
    { _id: { $in: studentIds }, schoolId: req.schoolId },
    {
      class: targetClassId,
      className: targetClass.className,
      section: targetSection,
      status: 'ENROLLED'
    }
  );
  
  // Update target section strength
  targetSectionData.currentStrength += students.length;
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
