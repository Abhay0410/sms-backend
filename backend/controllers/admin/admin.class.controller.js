// controllers/admin/admin.class.controller.js - MULTI-TENANT VERSION
import mongoose from 'mongoose';
import Class from '../../models/Class.js';
import Student from '../../models/Student.js';
import Enrollment from '../../models/Enrollment.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// Get all classes - MULTI-TENANT
export const getAllClasses = asyncHandler(async (req, res) => {
  const { academicYear, isActive } = req.query;
  
  // ✅ Tenant filter
  const filter = { schoolId: req.schoolId };
  
  if (academicYear) filter.academicYear = academicYear;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  
  const classes = await Class.find(filter)
    .populate('sections.classTeacher', 'name teacherID')
    .populate('sections.subjects.teacher', 'name teacherID')
    .sort({ classNumeric: 1, className: 1 });
  
  return successResponse(res, 'Classes retrieved successfully', classes);
});

// Alias for backward compatibility
export const getClasses = getAllClasses;

// Get class by ID - MULTI-TENANT
export const getClassById = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  
  const classData = await Class.findOne({ 
    _id: classId, 
    schoolId: req.schoolId  // ✅ Tenant Check
  })
    .populate('sections.classTeacher', 'name teacherID')
    .populate('sections.subjects.teacher', 'name teacherID');
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  return successResponse(res, 'Class retrieved successfully', classData);
});

// Create class - MULTI-TENANT
export const createClass = asyncHandler(async (req, res) => {
  const classData = req.body;
  
  if (!classData.className || !classData.academicYear) {
    throw new ValidationError('Class name and academic year are required');
  }

  // ✅ Smart Class Name Formatting
  let rawName = classData.className.trim();
  const lowerName = rawName.toLowerCase();
  if (!lowerName.startsWith('class')) {
    const prePrimaryNames = ['nursery', 'lkg', 'ukg', 'playgroup', 'pre-nursery'];
    const isPrePrimary = prePrimaryNames.some(p => lowerName.startsWith(p));
    if (!isPrePrimary) {
      rawName = `Class ${rawName}`;
    }
  }
  classData.className = rawName;
 const schoolId = req.user.schoolId;  // ✅ Always use user.schoolId

  console.log("Logged user schoolId:", schoolId);
  
  // ✅ Check duplicate within same school
  const existingClass = await Class.findOne({
    schoolId: req.schoolId,  // ✅ Tenant Check
    className: classData.className,
    academicYear: classData.academicYear
  });

 
  
  if (existingClass) {
    throw new ValidationError(`Class ${classData.className} already exists for academic year ${classData.academicYear}`);
  }
  
  const newClass = new Class({
    ...classData,
    schoolId: req.schoolId // ✅ Add Tenant ID
  });
  
  await newClass.save();
  
  return successResponse(res, 'Class created successfully', newClass, 201);
});

// Add section to existing class - MULTI-TENANT
export const addSection = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { sectionName, capacity, classTeacher } = req.body;
  
  if (!sectionName) {
    throw new ValidationError('Section name is required');
  }
  
  const classData = await Class.findOne({ 
    _id: classId, 
    schoolId: req.schoolId // ✅ Tenant Check
  });
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  // Check if section already exists
  const sectionExists = classData.sections.some(s => s.sectionName === sectionName);
  
  if (sectionExists) {
    throw new ValidationError(`Section ${sectionName} already exists in this class`);
  }
  
  // Add new section
  classData.sections.push({
    sectionName,
    capacity: capacity || 50,
    currentStrength: 0,
    classTeacher: classTeacher || null,
    subjects: []
  });
  
  await classData.save();
  
  return successResponse(res, 'Section added successfully', classData, 201);
});

// Update class - MULTI-TENANT
export const updateClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const updateData = req.body;
  
  const classData = await Class.findOneAndUpdate(
    { _id: classId, schoolId: req.schoolId }, // ✅ Tenant Check
    updateData, 
    { new: true, runValidators: true }
  );
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  return successResponse(res, 'Class updated successfully', classData);
});

// Delete class - MULTI-TENANT
export const deleteClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  
  // Check if class has students in THIS school
  const studentCount = await Enrollment.countDocuments({ 
    class: classId, 
    schoolId: req.schoolId 
  });
  
  if (studentCount > 0) {
    throw new ValidationError(`Cannot delete class with ${studentCount} enrolled students`);
  }
  
  const classData = await Class.findOneAndDelete({ 
    _id: classId, 
    schoolId: req.schoolId 
  });
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  return successResponse(res, 'Class deleted successfully');
});


export const assignStudentsToSection = asyncHandler(async (req, res) => {
  const { classId, sectionName } = req.params;
  const { studentIds } = req.body;

  const classData = await Class.findOne({ _id: classId, schoolId: req.schoolId });
  if (!classData) throw new NotFoundError('Class');

  const targetSection = classData.sections.find(s => s.sectionName === sectionName);
  if (!targetSection) throw new NotFoundError('Target Section');

  // 🔥 1. Calculate the starting point for roll numbers in this section
  const lastEnrollment = await Enrollment.findOne({ 
    schoolId: req.schoolId,
    class: classId,
    section: sectionName,
    academicYear: classData.academicYear
  })
  .sort({ rollNumber: -1 }) 
  .select('rollNumber');

  let nextRollNumber = lastEnrollment && lastEnrollment.rollNumber ? lastEnrollment.rollNumber + 1 : 1;
  const startingRollNumber = nextRollNumber;

  const updatePromises = studentIds.map(async (studentId) => {
    const student = await Student.findOne({ _id: studentId, schoolId: req.schoolId });
    if (!student) return null;

    let enrollment = await Enrollment.findOne({ student: studentId, academicYear: classData.academicYear, schoolId: req.schoolId });

    if (enrollment) {
      if (enrollment.section !== sectionName || enrollment.class.toString() !== classId) {
        const oldClassData = await Class.findOne({ _id: enrollment.class, schoolId: req.schoolId });
        if (oldClassData) {
          const oldSection = oldClassData.sections.find(s => s.sectionName === enrollment.section);
          if (oldSection && oldSection.currentStrength > 0) {
            oldSection.currentStrength -= 1;
            await oldClassData.save();
          }
        }
        targetSection.currentStrength += 1;
        enrollment.class = classId;
        enrollment.className = classData.className;
        enrollment.section = sectionName;
        enrollment.rollNumber = nextRollNumber++;
        enrollment.status = 'ACTIVE';
        await enrollment.save();
      }
    } else {
      targetSection.currentStrength += 1;
      await Enrollment.create({
        schoolId: req.schoolId,
        student: studentId,
        class: classId,
        className: classData.className,
        section: sectionName,
        academicYear: classData.academicYear,
        rollNumber: nextRollNumber++,
        status: 'ACTIVE'
      });
    }

    student.status = 'ACTIVE';
    await student.save();
    return student;
  });

  await Promise.all(updatePromises);
  await classData.save();

  return successResponse(
    res, 
    `Enrolled successfully. Roll numbers assigned from ${startingRollNumber}`, 
    classData
  );
});

// Promote students - MULTI-TENANT
export const promoteStudents = asyncHandler(async (req, res) => {
  const { 
    sourceClassId, 
    sourceSection, 
    targetClassId, 
    targetSection, 
    studentIds, 
    academicYear 
  } = req.body;
  
  // Validate classes belong to school
  const sourceClass = await Class.findOne({ _id: sourceClassId, schoolId: req.schoolId });
  const targetClass = await Class.findOne({ _id: targetClassId, schoolId: req.schoolId });
  
  if (!sourceClass || !targetClass) {
    throw new NotFoundError('Source or Target class not found');
  }
  
  // Get students to promote (within tenant)
  const filter = { class: sourceClassId, schoolId: req.schoolId, status: 'ACTIVE' };
  if (sourceSection) filter.section = sourceSection;
  if (studentIds && studentIds.length > 0) filter.student = { $in: studentIds };
  
  const enrollments = await Enrollment.find(filter);
  
  if (enrollments.length === 0) {
    throw new ValidationError('No students found to promote');
  }
  
  // Check target section capacity
  if (targetSection) {
    const targetSectionData = targetClass.sections.find(s => s.sectionName === targetSection);
    if (!targetSectionData) throw new NotFoundError('Target section');
    
    const availableSeats = targetSectionData.capacity - targetSectionData.currentStrength;
    if (enrollments.length > availableSeats) throw new ValidationError(`Only ${availableSeats} seats available in target section`);
  }

  const lastEnrollment = await Enrollment.findOne({
    schoolId: req.schoolId, class: targetClassId, section: targetSection, academicYear
  }).sort({ rollNumber: -1 }).lean();
  
  let nextRollNumber = lastEnrollment && lastEnrollment.rollNumber ? lastEnrollment.rollNumber + 1 : 1;
  
  // Promote students
  const promotePromises = enrollments.map(async (enrollment) => {
    // Decrease source section strength
    if (enrollment.section) {
      const sourceSection = sourceClass.sections.find(s => s.sectionName === enrollment.section);
      if (sourceSection && sourceSection.currentStrength > 0) {
        sourceSection.currentStrength -= 1;
      }
    }
    
    enrollment.status = 'PROMOTED';
    await enrollment.save();

    if (targetSection) {
      await Enrollment.create({
        schoolId: req.schoolId,
        student: enrollment.student,
        class: targetClassId,
        className: targetClass.className,
        section: targetSection,
        academicYear: academicYear,
        rollNumber: nextRollNumber++,
        status: 'ACTIVE'
      });
      await Student.updateOne({ _id: enrollment.student }, { status: 'ACTIVE' });
    } else {
      // Push back to admission pool waiting for section assignment
      await Student.updateOne({ _id: enrollment.student }, { 
        status: 'ADMITTED', 
        targetGrade: targetClass.className, 
        registrationYear: academicYear 
      });
    }
  });
  
  await Promise.all(promotePromises);
  
  // Update target section strength
  if (targetSection) {
    const targetSectionData = targetClass.sections.find(s => s.sectionName === targetSection);
    if (targetSectionData) {
      targetSectionData.currentStrength += enrollments.length;
    }
  }
  
  await sourceClass.save();
  await targetClass.save();
  
  return successResponse(res, `${enrollments.length} students promoted successfully`, {
    promotedCount: enrollments.length,
    sourceClass: sourceClass.className,
    targetClass: targetClass.className,
    academicYear
  });
});

// Copy Academic Year - MULTI-TENANT
export const copyAcademicYear = asyncHandler(async (req, res) => {
  const { sourceYear, targetYear } = req.body;
  
  // Check target year within tenant
  const existingClasses = await Class.countDocuments({ 
    schoolId: req.schoolId, 
    academicYear: targetYear 
  });
  
  if (existingClasses > 0) {
    throw new ValidationError(`Academic year ${targetYear} already has classes.`);
  }
  
  // Get source classes
  const sourceClasses = await Class.find({ 
    schoolId: req.schoolId, 
    academicYear: sourceYear 
  });
  
  if (sourceClasses.length === 0) {
    throw new NotFoundError(`No classes found for academic year ${sourceYear}`);
  }
  
  // Copy logic
  const newClasses = sourceClasses.map(cls => {
    const classData = cls.toObject();
    delete classData._id;
    delete classData.createdAt;
    delete classData.updatedAt;
    delete classData.__v;
    
    classData.sections = classData.sections.map(section => {
      delete section._id;
      section.currentStrength = 0;
      section.classTeacher = null;
      section.subjects = section.subjects.map(sub => {
        delete sub._id;
        sub.teacher = null;
        return sub;
      });
      return section;
    });
    
    classData.academicYear = targetYear;
    classData.schoolId = req.schoolId; // ✅ Ensure new classes have tenant ID
    
    return classData;
  });
  
  const result = await Class.insertMany(newClasses);
  
  return successResponse(res, `Successfully copied ${result.length} classes`, {
    copiedClasses: result.length
  }, 201);
});

// Get academic years - MULTI-TENANT
export const getAcademicYears = asyncHandler(async (req, res) => {
  const years = await Class.distinct('academicYear', { schoolId: req.schoolId });
  return successResponse(res, 'Academic years retrieved successfully', {
    years: years.sort().reverse()
  });
});


/// check if it is needed ?
// Update fee structure - MULTI-TENANT
export const updateClassFeeStructure = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { feeStructure, feeSettings } = req.body;

  const classData = await Class.findOne({ 
    _id: classId, 
    schoolId: req.schoolId 
  });

  if (!classData) {
    throw new NotFoundError('Class');
  }

  // Calculate total
  let totalAnnualFee = 0;
  if (feeStructure && feeStructure.length > 0) {
    totalAnnualFee = feeStructure.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
  }

  if (feeStructure) {
    classData.feeStructure = feeStructure.map(fee => ({
      feeName: fee.feeName.trim(),
      amount: Number(fee.amount),
      dueDate: fee.dueDate || null,
      _id: fee._id || new mongoose.Types.ObjectId()
    }));
  }

  if (feeSettings) {
    classData.feeSettings = {
      paymentSchedule: feeSettings.paymentSchedule || 'YEARLY',
      dueDate: feeSettings.dueDate || null,
      lateFeeAmount: Number(feeSettings.lateFeeAmount) || 0,
      lateFeeApplicableAfter: feeSettings.lateFeeApplicableAfter || null,
      totalAnnualFee
    };
  } else if (feeStructure) {
    classData.feeSettings.totalAnnualFee = totalAnnualFee;
  }

  await classData.save();

  return successResponse(res, 'Fee structure updated successfully', {
    class: { _id: classData._id, className: classData.className },
    feeStructure: classData.feeStructure,
    totalAnnualFee
  });
});

// Shift student between sections - MULTI-TENANT
export const shiftStudentSection = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { studentId, fromSection, toSection, academicYear } = req.body;

  if (!studentId || !fromSection || !toSection || !academicYear) {
    throw new ValidationError('Student ID, source section, target section, and academic year are required');
  }

  const classData = await Class.findOne({ _id: classId, schoolId: req.schoolId });
  if (!classData) throw new NotFoundError('Class');

  const sourceSection = classData.sections.find(s => s.sectionName === fromSection);
  const targetSection = classData.sections.find(s => s.sectionName === toSection);

  if (!sourceSection || !targetSection) throw new ValidationError('Invalid source or target section');

  // Check capacity in target
  if (targetSection.currentStrength >= targetSection.capacity) {
    throw new ValidationError(`Target section ${toSection} is full`);
  }

  // Update Enrollment Document
  const enrollment = await Enrollment.findOne({ student: studentId, academicYear, class: classId, schoolId: req.schoolId });
  if (!enrollment) throw new NotFoundError('Student Enrollment');

  // Get a new roll number for the target section
  const lastEnrollment = await Enrollment.findOne({
    schoolId: req.schoolId, class: classId, section: toSection, academicYear
  }).sort({ rollNumber: -1 }).lean();
  let nextRollNumber = lastEnrollment && lastEnrollment.rollNumber ? lastEnrollment.rollNumber + 1 : 1;

  enrollment.section = toSection;
  enrollment.rollNumber = nextRollNumber;
  await enrollment.save();

  // Update Class Strengths
  sourceSection.currentStrength = Math.max(0, sourceSection.currentStrength - 1);
  targetSection.currentStrength += 1;
  await classData.save();

  return successResponse(res, `Student shifted to section ${toSection} successfully`, {
    studentId,
    newSection: toSection
  });
});

// Get actual student counts from DB for all classes - MULTI-TENANT
export const getClassStatistics = asyncHandler(async (req, res) => {
  const { academicYear } = req.query;
  const schoolId = req.schoolId;

  // 1. Fetch all classes for the school/year
  const classes = await Class.find({ 
    schoolId, 
    ...(academicYear && { academicYear }) 
  })
    .populate('sections.classTeacher', 'name teacherID')  // 🔥 TEACHER DISPLAY KE LIYE
    .lean(); 

  // 2. Use Aggregation to count actual students in each section
  const stats = await Enrollment.aggregate([
    { 
      $match: { 
        schoolId: new mongoose.Types.ObjectId(schoolId), 
        academicYear,
        status: 'ACTIVE' 
      } 
    },
    { 
      $group: { 
        _id: { classId: "$class", section: "$section" }, 
        count: { $sum: 1 } 
      } 
    }
  ]);

  // 3. Map counts back to classes
  const updatedClasses = classes.map(cls => {
    let classTotal = 0;
    const updatedSections = cls.sections.map(sec => {
      const stat = stats.find(s => 
        s._id.classId?.toString() === cls._id.toString() && 
        s._id.section === sec.sectionName
      );
      const actualCount = stat ? stat.count : 0;
      classTotal += actualCount;
      return { ...sec, currentStrength: actualCount };
    });

    return { ...cls, sections: updatedSections, totalEnrolled: classTotal };
  });

  return successResponse(res, 'Statistics retrieved successfully', updatedClasses);
});


export const updateSection = asyncHandler(async (req, res) => {
  const { classId, sectionName } = req.params;
  const { sectionName: newSectionName, capacity } = req.body;

  const classData = await Class.findOne({ _id: classId, schoolId: req.schoolId });
  if (!classData) throw new NotFoundError('Class');

  const section = classData.sections.find(s => s.sectionName === sectionName);
  if (!section) throw new NotFoundError('Section');

  if (newSectionName) section.sectionName = newSectionName.toUpperCase();
  if (capacity !== undefined) section.capacity = Number(capacity);

  await classData.save();
  return successResponse(res, 'Section updated successfully', classData);
});

export const deleteSection = asyncHandler(async (req, res) => {
  const { classId, sectionName } = req.params;

  const classData = await Class.findOne({ _id: classId, schoolId: req.schoolId });
  if (!classData) throw new NotFoundError('Class');

  const section = classData.sections.find(s => s.sectionName === sectionName);
  if (!section) throw new NotFoundError('Section');

  if (section.currentStrength > 0) {
    throw new ValidationError('Cannot delete section with enrolled students');
  }

  classData.sections = classData.sections.filter(s => s.sectionName !== sectionName);
  await classData.save();

  return successResponse(res, 'Section deleted successfully', classData);
});

export default {
  getAllClasses,
  getClasses,
  getClassById,
  createClass,
  addSection,
  updateClass,
  deleteClass,
  assignStudentsToSection,
  promoteStudents,
  copyAcademicYear,
  getAcademicYears,
  updateClassFeeStructure,
  shiftStudentSection,
  getClassStatistics,
  updateSection,
  deleteSection,
};