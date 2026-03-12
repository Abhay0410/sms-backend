// controllers/admin/admin.teacherManagement.controller.js - MULTI-TENANT VERSION
import Teacher from '../../models/Teacher.js';
import Class from '../../models/Class.js';
import Timetable from '../../models/Timetable.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// Get all teachers with their assignments - MULTI-TENANT
export const getTeachersWithAssignments = asyncHandler(async (req, res) => {
  const { status, hasAssignments } = req.query;
  
  const filter = { schoolId: req.schoolId }; // ✅ MULTI-TENANT
  
  if (status) filter.status = status;
  
  const teachers = await Teacher.find(filter)
    .select('-password')
    .populate('assignedClasses.class', 'className sections')
    .sort({ name: 1 });
  
  // Filter by assignment status if requested
  let filteredTeachers = teachers;
  if (hasAssignments === 'true') {
    filteredTeachers = teachers.filter(t => t.assignedClasses && t.assignedClasses.length > 0);
  } else if (hasAssignments === 'false') {
    filteredTeachers = teachers.filter(t => !t.assignedClasses || t.assignedClasses.length === 0);
  }
  
  return successResponse(res, 'Teachers with assignments retrieved successfully', {
    teachers: filteredTeachers,
    totalTeachers: filteredTeachers.length
  });
});

// Assign teacher to section and subject - MULTI-TENANT
export const assignTeacherToSection = asyncHandler(async (req, res) => {
  const { teacherId, classId, sectionName, subjectName, isClassTeacher } = req.body;
  
  if (!teacherId || !classId || !sectionName || !subjectName) {
    throw new ValidationError('Teacher, class, section, and subject are required');
  }
  
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  // Find the section
  const section = classData.sections.find(s => s.sectionName === sectionName);
  if (!section) {
    throw new NotFoundError('Section');
  }
  
  // Find the subject
  const subject = section.subjects.find(s => s.subjectName === subjectName);
  if (!subject) {
    throw new NotFoundError('Subject in this section');
  }
  
  // Check if subject already has a teacher
  if (subject.teacher) {
    throw new ValidationError(`Subject ${subjectName} already has a teacher assigned. Remove existing teacher first.`);
  }
  
  // Assign teacher to subject
  subject.teacher = teacherId;
  
  // Assign class teacher if requested
  if (isClassTeacher) {
    if (section.classTeacher && section.classTeacher.toString() !== teacherId) {
      throw new ValidationError('Section already has a different class teacher. Remove existing one first.');
    }
    section.classTeacher = teacherId;
  }
  
  await classData.save();
  
  // Update teacher's assigned classes
  const existingAssignment = teacher.assignedClasses.find(
    ac => ac.class.toString() === classId && 
          ac.section === sectionName && 
          ac.subject === subjectName
  );
  
  if (!existingAssignment) {
    teacher.assignedClasses.push({
      class: classId,
      section: sectionName,
      subject: subjectName,
      isClassTeacher: isClassTeacher || false
    });
    await teacher.save();
  }
  
  return successResponse(res, 'Teacher assigned successfully', {
    class: classData.className,
    section: sectionName,
    subject: subjectName,
    teacher: teacher.name,
    isClassTeacher: isClassTeacher || false
  });
});

// Alias for assignSubjectTeacher
export const assignSubjectTeacher = assignTeacherToSection;

// Remove teacher from section and subject - MULTI-TENANT
export const removeTeacherFromSection = asyncHandler(async (req, res) => {
  const { teacherId, classId, sectionName, subjectName } = req.body;
  
  if (!teacherId || !classId || !sectionName || !subjectName) {
    throw new ValidationError('Teacher, class, section, and subject are required');
  }
  
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  // Find the section
  const section = classData.sections.find(s => s.sectionName === sectionName);
  if (section) {
    const subject = section.subjects.find(s => s.subjectName === subjectName);
    if (subject) {
      subject.teacher = null;
    }
    
    // Remove as class teacher if this was their only subject
    const remainingSubjects = section.subjects.filter(
      s => s.teacher && s.teacher.toString() === teacherId && s.subjectName !== subjectName
    );
    
    if (remainingSubjects.length === 0 && section.classTeacher && section.classTeacher.toString() === teacherId) {
      section.classTeacher = null;
    }
  }
  
  await classData.save();
  
  // Remove from teacher's assigned classes
  teacher.assignedClasses = teacher.assignedClasses.filter(
    ac => !(ac.class.toString() === classId && 
            ac.section === sectionName && 
            ac.subject === subjectName)
  );
  
  await teacher.save();
  
  return successResponse(res, 'Teacher removed successfully from subject');
});

// Alias for removeSubjectTeacher
export const removeSubjectTeacher = removeTeacherFromSection;

// Get teacher assignments - MULTI-TENANT
export const getTeacherAssignments = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  }).populate('assignedClasses.class', 'className sections');
  
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }
  
  return successResponse(res, 'Teacher assignments retrieved successfully', {
    teacherId: teacher._id,
    teacherName: teacher.name,
    teacherID: teacher.teacherID,
    totalAssignments: teacher.assignedClasses.length,
    assignments: teacher.assignedClasses
  });
});

// Assign class teacher - MULTI-TENANT
export const assignClassTeacher = asyncHandler(async (req, res) => {
  const { teacherId, classId, sectionName } = req.body;
  
  if (!teacherId || !classId || !sectionName) {
    throw new ValidationError('Teacher, class, and section are required');
  }
  
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!teacher) {
    throw new NotFoundError('Teacher');
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
  
  // Check if section already has a class teacher
  if (section.classTeacher && section.classTeacher.toString() !== teacherId) {
    const existingTeacher = await Teacher.findOne({
      _id: section.classTeacher,
      schoolId: req.schoolId
    });
    throw new ValidationError(
      `Section already has a class teacher (${existingTeacher ? existingTeacher.name : 'Unknown'}). Remove existing one first.`
    );
  }
  
  section.classTeacher = teacherId;
  await classData.save();
  
  // Update teacher's assignments to mark as class teacher
  teacher.assignedClasses.forEach(ac => {
    if (ac.class.toString() === classId && ac.section === sectionName) {
      ac.isClassTeacher = true;
    }
  });
  
  await teacher.save();
  
  return successResponse(res, 'Class teacher assigned successfully', {
    class: classData.className,
    section: sectionName,
    classTeacher: teacher.name,
    teacherID: teacher.teacherID
  });
});

// Remove class teacher - MULTI-TENANT
export const removeClassTeacher = asyncHandler(async (req, res) => {
  const { teacherId, classId, sectionName } = req.body;
  
  if (!classId || !sectionName) {
    throw new ValidationError('Class and section are required');
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
  
  if (!section.classTeacher) {
    throw new ValidationError('This section does not have a class teacher assigned');
  }
  
  // If teacherId provided, verify it matches
  if (teacherId && section.classTeacher.toString() !== teacherId) {
    throw new ValidationError('Provided teacher is not the class teacher of this section');
  }
  
  const removedTeacherId = section.classTeacher;
  section.classTeacher = null;
  await classData.save();
  
  // Update teacher's assignments
  if (removedTeacherId) {
    const teacher = await Teacher.findOne({
      _id: removedTeacherId,
      schoolId: req.schoolId  // ✅ MULTI-TENANT
    });
    if (teacher) {
      teacher.assignedClasses.forEach(ac => {
        if (ac.class.toString() === classId && ac.section === sectionName) {
          ac.isClassTeacher = false;
        }
      });
      await teacher.save();
    }
  }
  
  return successResponse(res, 'Class teacher removed successfully');
});

// Get section details with teacher assignments - MULTI-TENANT
export const getSectionTeachers = asyncHandler(async (req, res) => {
  const { classId, sectionName } = req.query;
  
  if (!classId || !sectionName) {
    throw new ValidationError('Class and section are required');
  }
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  })
    .populate('sections.classTeacher', 'name teacherID email phone')
    .populate('sections.subjects.teacher', 'name teacherID email phone');
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  const section = classData.sections.find(s => s.sectionName === sectionName);
  if (!section) {
    throw new NotFoundError('Section');
  }
  
  return successResponse(res, 'Section teachers retrieved successfully', {
    className: classData.className,
    sectionName: section.sectionName,
    classTeacher: section.classTeacher,
    subjects: section.subjects.map(sub => ({
      subjectName: sub.subjectName,
      subjectCode: sub.subjectCode,
      teacher: sub.teacher,
      hasTheory: sub.hasTheory,
      hasPractical: sub.hasPractical,
      hasIA: sub.hasIA
    }))
  });
});

// Get available subjects for a section (subjects without teachers) - MULTI-TENANT
export const getAvailableSubjectsForSection = asyncHandler(async (req, res) => {
  const { classId, sectionName } = req.query;
  
  if (!classId || !sectionName) {
    throw new ValidationError('Class and section are required');
  }
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  }).populate('sections.subjects.teacher', 'name teacherID');
  
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  const section = classData.sections.find(s => s.sectionName === sectionName);
  if (!section) {
    throw new NotFoundError('Section');
  }
  
  // Filter subjects that don't have a teacher assigned
  const availableSubjects = section.subjects
    .filter(sub => !sub.teacher)
    .map(sub => ({
      _id: sub._id,
      subjectName: sub.subjectName,
      subjectCode: sub.subjectCode,
      hoursPerWeek: sub.hoursPerWeek,
      hasTheory: sub.hasTheory,
      hasPractical: sub.hasPractical,
      hasIA: sub.hasIA
    }));
  
  return successResponse(res, 'Available subjects retrieved successfully', {
    className: classData.className,
    sectionName: sectionName,
    availableSubjects: availableSubjects,
    totalAvailable: availableSubjects.length
  });
});

export const getTeacherScheduleForAdmin = asyncHandler(async (req, res) => {
  const { teacherId } = req.query;
  const { academicYear = "2025-2026" } = req.query;

  if (!teacherId) throw new ValidationError("Teacher ID is required");

  const teacher = await Teacher.findOne({ _id: teacherId, schoolId: req.schoolId });
  if (!teacher) throw new NotFoundError("Teacher");

  const teacherClassIds = teacher.assignedClasses?.map(ac => ac.class) || [];

  // ✅ Timetable find logic
  const timetables = await Timetable.find({
    schoolId: req.schoolId,
    class: { $in: teacherClassIds },
    academicYear,
    status: "published",
    isActive: true
  }).populate('class', 'className');

  const schedule = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: []
  };

  timetables.forEach((tt) => {
    if (tt.schedule) {
      tt.schedule.forEach((dayEntry) => {
        dayEntry.periods.forEach((period) => {
          // Check if this teacher is assigned to this specific period
          if (period.teacher && period.teacher.toString() === teacherId) {
            schedule[dayEntry.day].push({
              className: tt.class?.className || "N/A",
              section: tt.section,
              periodNumber: period.periodNumber,
              subject: period.subject,
              startTime: period.startTime,
              endTime: period.endTime,
              room: period.room || "N/A"
            });
          }
        });
      });
    }
  });

  return successResponse(res, "Schedule retrieved", { schedule });
});

export default {
  getTeachersWithAssignments,
  assignTeacherToSection,
  assignSubjectTeacher,
  removeTeacherFromSection,
  removeSubjectTeacher,
  getTeacherAssignments,
  assignClassTeacher,
  removeClassTeacher,
  getSectionTeachers,
  getAvailableSubjectsForSection,
  getTeacherScheduleForAdmin,
};
