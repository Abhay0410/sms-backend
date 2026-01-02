// controllers/admin/admin.teacher.controller.js - MULTI-TENANT VERSION
import Teacher from '../../models/Teacher.js';
import Class from '../../models/Class.js';
import bcrypt from 'bcryptjs';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { getPaginationParams } from '../../utils/pagination.js';

// Get all teachers (WITH ALIAS) - MULTI-TENANT
// export const getAllTeachers = asyncHandler(async (req, res) => {
//   const { page, limit, skip } = getPaginationParams(req);
//   const { status, search, subject } = req.query;
  
//   const filter = { schoolId: req.schoolId }; // ✅ MULTI-TENANT
  
//   if (status) filter.status = status;
//   if (subject) filter.subjects = subject;
  
//   if (search) {
//     filter.$or = [
//       { name: { $regex: search, $options: 'i' } },
//       { teacherID: { $regex: search, $options: 'i' } },
//       { email: { $regex: search, $options: 'i' } }
//     ];
//   }
  
//   const [teachers, total] = await Promise.all([
//     Teacher.find(filter)
//       .select('-password')
//       .populate('assignedClasses.class', 'className')
//       .sort({ teacherID: 1 })
//       .skip(skip)
//       .limit(limit),
//     Teacher.countDocuments(filter)
//   ]);
  
//   return paginatedResponse(res, 'Teachers retrieved successfully', teachers, page, limit, total);
// });

// Get all teachers (FRONTEND COMPATIBLE) - MULTI-TENANT
export const getAllTeachers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { status, search, subject } = req.query;

  const filter = { schoolId: req.schoolId };

  if (status) filter.status = status;
  if (subject) filter.subjects = subject;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { teacherID: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const [teachers, total] = await Promise.all([
    Teacher.find(filter)
      .select('-password')
      .populate('assignedClasses.class', 'className')
      .sort({ teacherID: 1 })
      .skip(skip)
      .limit(limit),
    Teacher.countDocuments(filter)
  ]);

  // 🔥 TRANSFORM DATA FOR FRONTEND
  const formattedTeachers = teachers.map((teacher) => {
    const classTeacher = [];
    const subjects = [];
    let totalWorkload = 0;

    teacher.assignedClasses.forEach((ac) => {
      // Class Teacher
      if (ac.isClassTeacher) {
        classTeacher.push({
          className: ac.class?.className,
          section: ac.section
        });
      }

      // Subject Teacher
      if (!ac.isClassTeacher && ac.subject) {
        subjects.push({
          subject: ac.subject,
          className: ac.class?.className,
          section: ac.section,
          hoursPerWeek: ac.hoursPerWeek || 0
        });

        totalWorkload += ac.hoursPerWeek || 0;
      }
    });

    return {
      ...teacher.toObject(),
      assignments: {
        classTeacher,
        subjects
      },
      totalWorkload
    };
  });

  return paginatedResponse(
    res,
    'Teachers retrieved successfully',
    formattedTeachers,
    page,
    limit,
    total
  );
});


// Alias for backward compatibility
export const getTeachers = getAllTeachers;

// Get teacher by ID - MULTI-TENANT
export const getTeacherById = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  })
    .select('-password')
    .populate('assignedClasses.class', 'className sections');
  
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }
  
  return successResponse(res, 'Teacher retrieved successfully', teacher);
});

// Create teacher - MULTI-TENANT
export const createTeacher = asyncHandler(async (req, res) => {
  const {
    name, email, password, phone, dateOfBirth, gender, address,
    qualification, specialization, experience, joiningDate,
    employmentType, salary, subjects,department
  } = req.body;
  
  if (!name || !email || !phone) {
    throw new ValidationError('Name, email, and phone are required');
  }
  
  // Check if email exists - MULTI-TENANT
  const existingTeacher = await Teacher.findOne({ 
    email,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (existingTeacher) {
    throw new ValidationError('Email already exists');
  }
  
  // ✅ Generate teacher ID per SCHOOL - MULTI-TENANT
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await Teacher.countDocuments({ schoolId: req.schoolId });
  const teacherID = `TCHR${year}${(count + 1).toString().padStart(4, '0')}`;
  
  // ✅ Generate default password: Teacher@YYYY
  const defaultPassword = `Teacher@${new Date().getFullYear()}`;
  const hashedPassword = password ? 
    await bcrypt.hash(password, 10) : 
    await bcrypt.hash(defaultPassword, 10);
  
  const teacher = new Teacher({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    name,
    email,
    password: hashedPassword,
    teacherID,
    phone,
    dateOfBirth,
    department,
    gender,
    address,
    qualification,
    specialization,
    experience,
    joiningDate: joiningDate || new Date(),
    employeeType: employmentType || 'PERMANENT',  // Fixed field name
    salary,
    subjects: subjects || [],
    assignedClasses: [],
    role: 'teacher',
    status: 'ACTIVE',
    isActive: true
  });
  
  await teacher.save();
  
  const teacherResponse = teacher.toObject();
  delete teacherResponse.password;
  
  // ✅ Include credentials in response
  teacherResponse.credentials = {
    teacherID: teacher.teacherID,
    defaultPassword: password || defaultPassword,
    note: 'Please share these credentials with the teacher and advise them to change the password after first login.'
  };
  
  return successResponse(res, 'Teacher created successfully', teacherResponse, 201);
});

// Update teacher - MULTI-TENANT
export const updateTeacher = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const updateData = req.body;
  
  // Don't allow updating these fields
  delete updateData.password;
  delete updateData.teacherID;
  delete updateData.role;
  delete updateData.schoolId;  // Prevent school change
  
  const teacher = await Teacher.findOneAndUpdate(
    { 
      _id: teacherId,
      schoolId: req.schoolId  // ✅ MULTI-TENANT
    },
    updateData,
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }
  
  return successResponse(res, 'Teacher updated successfully', teacher);
});

// Delete teacher - MULTI-TENANT
export const deleteTeacher = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }
  
  // Check if teacher is assigned to any class
  if (teacher.assignedClasses && teacher.assignedClasses.length > 0) {
    throw new ValidationError('Cannot delete teacher with active class assignments. Please remove class assignments first.');
  }
  
  await teacher.deleteOne();
  
  return successResponse(res, 'Teacher deleted successfully');
});

// Assign class to teacher - MULTI-TENANT
// export const assignClassToTeacher = asyncHandler(async (req, res) => {
//   const { teacherId } = req.params;
//   const { classId, section, subject, isClassTeacher } = req.body;
  
//   if (!classId || !section || !subject) {
//     throw new ValidationError('Class, section, and subject are required');
//   }
  
//   const teacher = await Teacher.findOne({
//     _id: teacherId,
//     schoolId: req.schoolId  // ✅ MULTI-TENANT
//   });
//   if (!teacher) {
//     throw new NotFoundError('Teacher');
//   }
  
//   const classData = await Class.findOne({
//     _id: classId,
//     schoolId: req.schoolId  // ✅ MULTI-TENANT
//   });
//   if (!classData) {
//     throw new NotFoundError('Class');
//   }
  
//   // Check if already assigned
//   const alreadyAssigned = teacher.assignedClasses.some(
//     ac => ac.class.toString() === classId && 
//           ac.section === section && 
//           ac.subject === subject
//   );
  
//   if (alreadyAssigned) {
//     throw new ValidationError('Teacher already assigned to this class and subject');
//   }
  
//   // Add to teacher's assigned classes
//   teacher.assignedClasses.push({
//     class: classId,
//     section,
//     subject,
//     isClassTeacher: isClassTeacher || false
//   });
  
//   await teacher.save();
  
//   // Update class section with teacher assignment
//   const sectionData = classData.sections.find(s => s.sectionName === section);
//   if (sectionData) {
//     const subjectData = sectionData.subjects.find(s => s.subjectName === subject);
//     if (subjectData) {
//       subjectData.teacher = teacherId;
//     }
    
//     if (isClassTeacher) {
//       sectionData.classTeacher = teacherId;
//     }
    
//     await classData.save();
//   }
  
//   return successResponse(res, 'Class assigned to teacher successfully', teacher);
// });
export const assignClassTeacher = asyncHandler(async (req, res) => {
  const { teacherId, classId, sectionName } = req.body;

  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId
  });

  if (!teacher) throw new NotFoundError('Teacher');

  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId
  });

  if (!classData) throw new NotFoundError('Class');

  // 🔥 PUSH CORRECT FORMAT
  teacher.assignedClasses.push({
    class: classId,
    section: sectionName,
    isClassTeacher: true
  });

  await teacher.save();

  // Update class section
  const section = classData.sections.find(
    s => s.sectionName === sectionName
  );

  if (section) {
    section.classTeacher = teacherId;
    await classData.save();
  }

  return successResponse(res, 'Class teacher assigned successfully');
});

export const assignSubjectTeacher = asyncHandler(async (req, res) => {
  const {
    teacherId,
    classId,
    sectionName,
    subjectName,
    hoursPerWeek
  } = req.body;

  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId
  });

  if (!teacher) throw new NotFoundError('Teacher');

  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId
  });

  if (!classData) throw new NotFoundError('Class');

  // 🔥 PUSH SUBJECT ASSIGNMENT
  teacher.assignedClasses.push({
    class: classId,
    section: sectionName,
    subject: subjectName,
    hoursPerWeek,
    isClassTeacher: false
  });

  await teacher.save();

  // Update class section subject teacher
  const section = classData.sections.find(
    s => s.sectionName === sectionName
  );

  if (section) {
    const subject = section.subjects.find(
      s => s.subjectName === subjectName
    );
    if (subject) subject.teacher = teacherId;
    await classData.save();
  }

  return successResponse(res, 'Subject teacher assigned successfully');
});


// Update teacher status - MULTI-TENANT
export const updateTeacherStatus = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const { status } = req.body;
  
  if (!['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED'].includes(status)) {
    throw new ValidationError('Invalid status');
  }
  
  const teacher = await Teacher.findOneAndUpdate(
    { 
      _id: teacherId,
      schoolId: req.schoolId  // ✅ MULTI-TENANT
    },
    { status, isActive: status === 'ACTIVE' },
    { new: true }
  ).select('-password');
  
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }
  
  return successResponse(res, 'Teacher status updated successfully', teacher);
});

// Toggle teacher active status - MULTI-TENANT
export const toggleTeacherStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const teacher = await Teacher.findOne({
    _id: id,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }
  
  teacher.isActive = !teacher.isActive;
  teacher.status = teacher.isActive ? 'ACTIVE' : 'SUSPENDED';
  await teacher.save();
  
  const teacherResponse = teacher.toObject();
  delete teacherResponse.password;
  
  return successResponse(
    res, 
    `Teacher ${teacher.isActive ? 'activated' : 'deactivated'} successfully`, 
    teacherResponse
  );
});

export default {
  getAllTeachers,
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  assignClassTeacher,
  updateTeacherStatus,
  toggleTeacherStatus,
  assignSubjectTeacher
};
