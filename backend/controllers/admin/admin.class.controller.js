// controllers/admin/admin.class.controller.js - MULTI-TENANT VERSION
import mongoose from 'mongoose';
import Class from '../../models/Class.js';
import Student from '../../models/Student.js';
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
  const studentCount = await Student.countDocuments({ 
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

// Assign students to section - MULTI-TENANT
export const assignStudentsToSection = asyncHandler(async (req, res) => {
  const { classId, sectionName } = req.params;
  const { studentIds } = req.body;
  
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ValidationError('Student IDs array is required');
  }
  
  const classData = await Class.findOne({ 
    _id: classId, 
    schoolId: req.schoolId 
  });
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  const section = classData.sections.find(s => s.sectionName === sectionName);
  
  if (!section) {
    throw new NotFoundError('Section');
  }
  
  // Check capacity
  const availableSeats = section.capacity - section.currentStrength;
  
  if (studentIds.length > availableSeats) {
    throw new ValidationError(`Only ${availableSeats} seats available in section ${sectionName}`);
  }
  
  // Validate students belong to school
  const updatePromises = studentIds.map(async (studentId, index) => {
    const student = await Student.findOne({ 
      _id: studentId, 
      schoolId: req.schoolId // ✅ Strict Tenant Check
    });
    
    if (student) {
      student.class = classId;
      student.className = classData.className;
      student.section = sectionName;
      student.rollNumber = (section.currentStrength + index + 1).toString().padStart(2, '0');
      student.status = 'ENROLLED';
      student.academicYear = classData.academicYear;
      
      await student.save();
      return student;
    }
    return null;
  });
  
  const updatedStudents = await Promise.all(updatePromises);
  const successCount = updatedStudents.filter(s => s !== null).length;
  
  // Update section strength
  section.currentStrength += successCount;
  await classData.save();
  
  return successResponse(res, `${successCount} students assigned to section ${sectionName}`, {
    assignedCount: successCount,
    className: classData.className,
    section: sectionName,
    newStrength: section.currentStrength,
    capacity: section.capacity,
    availableSeats: section.capacity - section.currentStrength,
    students: updatedStudents.filter(s => s !== null).map(s => ({
      id: s._id,
      studentID: s.studentID,
      name: s.name,
      rollNumber: s.rollNumber,
      section: s.section
    }))
  });
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
  const filter = { class: sourceClassId, schoolId: req.schoolId };
  if (sourceSection) filter.section = sourceSection;
  if (studentIds && studentIds.length > 0) filter._id = { $in: studentIds };
  
  const students = await Student.find(filter);
  
  if (students.length === 0) {
    throw new ValidationError('No students found to promote');
  }
  
  // Check target section capacity
  if (targetSection) {
    const targetSectionData = targetClass.sections.find(s => s.sectionName === targetSection);
    if (!targetSectionData) throw new NotFoundError('Target section');
    
    const availableSeats = targetSectionData.capacity - targetSectionData.currentStrength;
    if (students.length > availableSeats) throw new ValidationError(`Only ${availableSeats} seats available in target section`);
  }
  
  // Promote students
  const promotePromises = students.map(async (student) => {
    // Decrease source section strength
    if (student.section) {
      const sourceSection = sourceClass.sections.find(s => s.sectionName === student.section);
      if (sourceSection && sourceSection.currentStrength > 0) {
        sourceSection.currentStrength -= 1;
      }
    }
    
    student.class = targetClassId;
    student.className = targetClass.className;
    student.section = targetSection || '';
    student.academicYear = academicYear;
    student.rollNumber = '';
    student.status = targetSection ? 'ENROLLED' : 'REGISTERED';
    
    await student.save();
    return student;
  });
  
  await Promise.all(promotePromises);
  
  // Update target section strength
  if (targetSection) {
    const targetSectionData = targetClass.sections.find(s => s.sectionName === targetSection);
    if (targetSectionData) {
      targetSectionData.currentStrength += students.length;
    }
  }
  
  await sourceClass.save();
  await targetClass.save();
  
  return successResponse(res, `${students.length} students promoted successfully`, {
    promotedCount: students.length,
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
};
