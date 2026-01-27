// controllers/admin/admin.subjectManagement.controller.js - MULTI-TENANT VERSION
import Class from '../../models/Class.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// Get all subjects across all classes - MULTI-TENANT
export const getAllSubjects = asyncHandler(async (req, res) => {
  const { academicYear, className } = req.query;
  
  const filter = { schoolId: req.schoolId }; // ✅ MULTI-TENANT
  
  if (academicYear) filter.academicYear = academicYear;
  if (className) filter.className = className;
  
  const classes = await Class.find(filter)
    .populate('sections.subjects.teacher', 'name teacherID');
  
  // Extract all unique subjects
  const subjectsMap = new Map();
  
  classes.forEach(cls => {
    cls.sections.forEach(section => {
      section.subjects.forEach(subject => {
        const key = `${subject.subjectName}_${subject.subjectCode || ''}`;
        if (!subjectsMap.has(key)) {
          subjectsMap.set(key, {
            subjectName: subject.subjectName,
            subjectCode: subject.subjectCode,
            hasTheory: subject.hasTheory,
            hasPractical: subject.hasPractical,
            hasIA: subject.hasIA,
            theoryMaxMarks: subject.theoryMaxMarks,
            practicalMaxMarks: subject.practicalMaxMarks,
            iaMaxMarks: subject.iaMaxMarks,
            classes: []
          });
        }
        
        const subjectData = subjectsMap.get(key);
        subjectData.classes.push({
          className: cls.className,
          section: section.sectionName,
          teacher: subject.teacher,
          hoursPerWeek: subject.hoursPerWeek
        });
      });
    });
  });
  
  const subjects = Array.from(subjectsMap.values());
  
  return successResponse(res, 'Subjects retrieved successfully', {
    subjects,
    totalSubjects: subjects.length
  });
});

// Get subjects for a specific class - MULTI-TENANT
export const getSubjectsByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId
  }).populate('sections.subjects.teacher', 'name teacherID email');
  
  if (!classData) {
    throw new NotFoundError('Class');
  }

  /**
   * 🎯 MASTER POOL LOGIC
   * We want to show a unique list of subjects that belong to this class.
   * We combine 'commonSubjects' (the master list) with any unique subjects 
   * found in specific sections to ensure nothing is missed.
   */
  const subjectsMap = new Map();

  // 1. Add subjects from the Class Master Pool (commonSubjects)
  if (classData.commonSubjects && Array.isArray(classData.commonSubjects)) {
    classData.commonSubjects.forEach(subName => {
      subjectsMap.set(subName.toUpperCase(), {
        subjectName: subName,
        isMaster: true // Flag to show this is part of the class group
      });
    });
  }

  // 2. Scan sections to populate details (Marks, Codes, etc.) for those subjects
  classData.sections.forEach(sec => {
    if (sec.subjects && Array.isArray(sec.subjects)) {
      sec.subjects.forEach(sub => {
        const key = sub.subjectName.toUpperCase();
        
        // Update the map with full details if they exist in a section
        subjectsMap.set(key, {
          _id: sub._id,
          subjectName: sub.subjectName,
          subjectCode: sub.subjectCode || '',
          hasTheory: sub.hasTheory,
          hasPractical: sub.hasPractical,
          hasIA: sub.hasIA,
          theoryMaxMarks: sub.theoryMaxMarks,
          practicalMaxMarks: sub.practicalMaxMarks,
          iaMaxMarks: sub.iaMaxMarks,
          isCore: sub.isCore !== false,
          isMaster: true
        });
      });
    }
  });

  const availableSubjects = Array.from(subjectsMap.values());

  return successResponse(res, 'Subjects retrieved successfully', {
    className: classData.className,
    classId: classData._id,
    academicYear: classData.academicYear,
    // 🔥 This is your "Group" view
    classMasterPool: classData.commonSubjects || [], 
    // 🔥 This is your "Available Subjects" with full metadata for the UI
    availableSubjects: availableSubjects,
    // 📊 Section-wise breakdown for teacher assignments
    sections: classData.sections.map(sec => ({
      sectionName: sec.sectionName,
      subjects: sec.subjects || []
    }))
  });
});

export const addSubjectToClass = asyncHandler(async (req, res) => {
  const { classId, subject } = req.body;

  if (!classId || !subject || !subject.subjectName) {
    throw new ValidationError('Class ID and Subject Name are required');
  }

  const classData = await Class.findOne({ _id: classId, schoolId: req.schoolId });
  if (!classData) throw new NotFoundError('Class');

  // 🔥 MASTER POOL LOGIC: 
  // We strictly add it to the commonSubjects array only.
  const subjectNameUpper = subject.subjectName.trim().toUpperCase();
  
  // Check if already in commonSubjects
  const isDuplicate = classData.commonSubjects.some(
    s => s.toUpperCase() === subjectNameUpper
  );

  if (isDuplicate) {
    throw new ValidationError(`Subject ${subject.subjectName} already exists in the Class Group`);
  }

  // 1. Only add to the Master Array
  classData.commonSubjects.push(subject.subjectName.trim());

  // ❌ REMOVED: The loop that was pushing to all sections
  
  await classData.save();

  return successResponse(res, 'Subject added to Class Master Pool only', {
    subjectName: subject.subjectName,
    className: classData.className,
    totalInPool: classData.commonSubjects.length
  }, 201);
});

// Add subject to multiple sections - MULTI-TENANT
export const addSubjectToSections = asyncHandler(async (req, res) => {
  const { classId, sectionNames, subject } = req.body;
  
  if (!classId || !sectionNames || !Array.isArray(sectionNames) || !subject || !subject.subjectName) {
    throw new ValidationError('Class, sections, and subject details are required');
  }
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId
  });
  
  if (!classData) throw new NotFoundError('Class');
  
  const results = { success: [], failed: [] };
  
  for (const sectionName of sectionNames) {
    const section = classData.sections.find(s => s.sectionName === sectionName);
    
    if (!section) {
      results.failed.push({ section: sectionName, reason: 'Section not found' });
      continue;
    }
    
    const subjectExists = section.subjects.some(s => s.subjectName === subject.subjectName);
    if (subjectExists) {
      results.failed.push({ section: sectionName, reason: 'Subject already exists' });
      continue;
    }
    
    // FIX: You MUST provide schoolId here because subjectSchema requires it
    section.subjects.push({
      schoolId: req.schoolId, // 👈 THE CRITICAL FIX
      subjectName: subject.subjectName,
      subjectCode: subject.subjectCode || '',
      hasTheory: subject.hasTheory !== false,
      hasPractical: subject.hasPractical || false,
      hasIA: subject.hasIA !== false,
      theoryMaxMarks: subject.theoryMaxMarks || 100,
      practicalMaxMarks: subject.practicalMaxMarks || 0,
      iaMaxMarks: subject.iaMaxMarks || 20,
      hoursPerWeek: subject.hoursPerWeek || 5,
      teacher: subject.teacher || null
    });
    
    results.success.push(sectionName);
  }
  
  await classData.save();
  
  return successResponse(res, `Subject added to ${results.success.length} sections`, {
    addedToSections: results.success,
    failed: results.failed
  }, 201);
});

// Update subject in class section - MULTI-TENANT
export const updateSubject = asyncHandler(async (req, res) => {
  const { classId, sectionName, subjectName, updates } = req.body;
  
  if (!classId || !sectionName || !subjectName) {
    throw new ValidationError('Class, section, and subject name are required');
  }
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  const section = classData.sections.find(s => s.sectionName === sectionName);
  if (!section) {
    throw new NotFoundError('Section');
  }
  
  const subject = section.subjects.find(s => s.subjectName === subjectName);
  if (!subject) {
    throw new NotFoundError('Subject');
  }
  
  // Update subject fields
  if (updates.subjectCode !== undefined) subject.subjectCode = updates.subjectCode;
  if (updates.hasTheory !== undefined) subject.hasTheory = updates.hasTheory;
  if (updates.hasPractical !== undefined) subject.hasPractical = updates.hasPractical;
  if (updates.hasIA !== undefined) subject.hasIA = updates.hasIA;
  if (updates.theoryMaxMarks !== undefined) subject.theoryMaxMarks = updates.theoryMaxMarks;
  if (updates.practicalMaxMarks !== undefined) subject.practicalMaxMarks = updates.practicalMaxMarks;
  if (updates.iaMaxMarks !== undefined) subject.iaMaxMarks = updates.iaMaxMarks;
  if (updates.hoursPerWeek !== undefined) subject.hoursPerWeek = updates.hoursPerWeek;
  if (updates.teacher !== undefined) subject.teacher = updates.teacher;
  
  await classData.save();
  
  return successResponse(res, 'Subject updated successfully', {
    className: classData.className,
    section: sectionName,
    subject
  });
});

// Remove subject from class section - MULTI-TENANT
export const removeSubject = asyncHandler(async (req, res) => {
  const { classId, sectionName, subjectName } = req.body;
  
  if (!classId || !sectionName || !subjectName) {
    throw new ValidationError('Class, section, and subject name are required');
  }
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  const section = classData.sections.find(s => s.sectionName === sectionName);
  if (!section) {
    throw new NotFoundError('Section');
  }
  
  const subjectIndex = section.subjects.findIndex(s => s.subjectName === subjectName);
  if (subjectIndex === -1) {
    throw new NotFoundError('Subject');
  }
  
  section.subjects.splice(subjectIndex, 1);
  await classData.save();
  
  return successResponse(res, 'Subject removed successfully', {
    className: classData.className,
    section: sectionName,
    removedSubject: subjectName
  });
});

// Remove subject from multiple sections - MULTI-TENANT
export const removeSubjectFromSections = asyncHandler(async (req, res) => {
  const { classId, sectionNames, subjectName } = req.body;
  
  if (!classId || !sectionNames || !Array.isArray(sectionNames) || !subjectName) {
    throw new ValidationError('Class, sections array, and subject name are required');
  }
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const sectionName of sectionNames) {
    const section = classData.sections.find(s => s.sectionName === sectionName);
    
    if (!section) {
      results.failed.push({
        section: sectionName,
        reason: 'Section not found'
      });
      continue;
    }
    
    const subjectIndex = section.subjects.findIndex(s => s.subjectName === subjectName);
    if (subjectIndex === -1) {
      results.failed.push({
        section: sectionName,
        reason: 'Subject not found'
      });
      continue;
    }
    
    section.subjects.splice(subjectIndex, 1);
    results.success.push(sectionName);
  }
  
  await classData.save();
  
  return successResponse(res, `Subject removed from ${results.success.length} sections`, {
    className: classData.className,
    subjectName,
    removedFromSections: results.success,
    failed: results.failed
  });
});

// Get subject statistics - MULTI-TENANT
export const getSubjectStatistics = asyncHandler(async (req, res) => {
  const { academicYear } = req.query;
  
  const filter = { schoolId: req.schoolId };
  if (academicYear) filter.academicYear = academicYear;
  
  const classes = await Class.find(filter)
    .populate('sections.subjects.teacher', 'name');
  
  const stats = {
    totalSubjects: 0,
    subjectsWithTeachers: 0,
    subjectsWithoutTeachers: 0,
    subjectsList: new Map()
  };
  
  classes.forEach(cls => {
    cls.sections.forEach(section => {
      section.subjects.forEach(subject => {
        stats.totalSubjects++;
        
        if (subject.teacher) {
          stats.subjectsWithTeachers++;
        } else {
          stats.subjectsWithoutTeachers++;
        }
        
        if (!stats.subjectsList.has(subject.subjectName)) {
          stats.subjectsList.set(subject.subjectName, {
            name: subject.subjectName,
            count: 0,
            classes: []
          });
        }
        
        const subjectInfo = stats.subjectsList.get(subject.subjectName);
        subjectInfo.count++;
        subjectInfo.classes.push({
          className: cls.className,
          section: section.sectionName
        });
      });
    });
  });
  
  return successResponse(res, 'Subject statistics retrieved successfully', {
    totalSubjects: stats.totalSubjects,
    uniqueSubjects: stats.subjectsList.size,
    subjectsWithTeachers: stats.subjectsWithTeachers,
    subjectsWithoutTeachers: stats.subjectsWithoutTeachers,
    subjects: Array.from(stats.subjectsList.values())
  });
});

// ✅ NEW: Remove subject from Class Master Pool - MULTI-TENANT
export const removeSubjectFromMasterPool = asyncHandler(async (req, res) => {
  const { classId, subjectName } = req.body;

  if (!classId || !subjectName) {
    throw new ValidationError('Class ID and Subject Name are required');
  }

  const classData = await Class.findOne({ _id: classId, schoolId: req.schoolId });
  if (!classData) throw new NotFoundError('Class');

  // 1. Remove from commonSubjects array
  const initialLength = classData.commonSubjects.length;
  classData.commonSubjects = classData.commonSubjects.filter(
    s => s.toLowerCase() !== subjectName.toLowerCase()
  );

  if (classData.commonSubjects.length === initialLength) {
    throw new NotFoundError('Subject not found in Master Pool');
  }

  // 2. Cleanup: Remove this subject from ALL sections in this class automatically
  classData.sections.forEach(section => {
    section.subjects = section.subjects.filter(
      s => s.subjectName.toLowerCase() !== subjectName.toLowerCase()
    );
  });

  await classData.save();

  return successResponse(res, 'Subject removed from Master Pool and all Sections', {
    removedSubject: subjectName,
    remainingCount: classData.commonSubjects.length
  });
});

export default {
  getAllSubjects,
  getSubjectsByClass,
  addSubjectToClass,
  addSubjectToSections,
  updateSubject,
  removeSubject,
  removeSubjectFromSections,
  getSubjectStatistics,
  removeSubjectFromMasterPool
};
