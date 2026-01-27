// controllers/auth/teacher.auth.controller.js - MULTI-TENANT VERSION
import bcrypt from "bcryptjs";
import Teacher from "../../models/Teacher.js";
import { signToken } from "../../utils/jwt.js";
import { successResponse } from "../../utils/response.js";
import { ValidationError, AuthenticationError, NotFoundError } from "../../utils/errors.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

function safeTeacher(teacher) {
  if (!teacher) return null;
  const {
    _id, teacherID, name, email, phone, address, gender, dateOfBirth,
    qualification, subjects, assignedClasses, role, profilePicture, 
    joiningDate, employmentType, createdAt, updatedAt, status, schoolId,
    department
  } = teacher;
  return {
    id: _id, teacherID, name, email, phone, address, gender, dateOfBirth,
    qualification, subjects, assignedClasses, role, profilePicture,
    joiningDate, employmentType, createdAt, updatedAt, status, schoolId,
    department 
  };
}

// POST /api/auth/teacher/login - MULTI-TENANT
export const login = asyncHandler(async (req, res) => {
  // ✅ FIX: Extract schoolId from request body - REQUIRED for tenant isolation
  const { teacherID, password, schoolId } = req.body || {};

  if (!teacherID || !password || !schoolId) {
    throw new ValidationError("teacherID, password, and schoolId are required");
  }

  // ✅ FIX: Query MUST include schoolId to ensure tenant isolation
  const teacher = await Teacher.findOne({ 
    teacherID, 
    schoolId // This ensures teacher can only login to their own school
  }).select("+password");
  
  if (!teacher) {
    throw new AuthenticationError("Invalid credentials for this institution.");
  }

  if (!teacher.isActive) {
    throw new AuthenticationError("Account is inactive. Please contact administrator.");
  }

  const isMatch = await bcrypt.compare(password, teacher.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Invalid credentials");
  }

  // Verify that the schoolId in token matches the teacher's schoolId
  if (teacher.schoolId.toString() !== schoolId.toString()) {
    throw new AuthenticationError("Unauthorized access to this institution.");
  }

  // Update last login
  teacher.lastLogin = new Date();
  await teacher.save();

  // ✅ MULTI-TENANT: Include schoolId in JWT payload
  const tokenPayload = { 
    id: teacher._id.toString(), 
    role: "teacher",
    schoolId: teacher.schoolId.toString(),  // ✅ Ensure string format
    isSuperAdmin: teacher.isSuperAdmin || false
  };
  
  console.log("🔐 Teacher login successful:", {
    teacherID: teacher.teacherID,
    schoolId: teacher.schoolId,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  const token = signToken(tokenPayload);

  return successResponse(
    res,
    "Login successful",
    {
      token,
      role: "teacher",
      schoolId: teacher.schoolId,
      teacher: safeTeacher(teacher),
    }
  );
});

// POST /api/auth/teacher/validate - MULTI-TENANT
export const validate = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({
    _id: req.user.id,
    schoolId: req.schoolId  // ✅ Verify school match
  }).populate('assignedClasses.class', 'className sections');
  
  if (!teacher) {
    throw new NotFoundError("Teacher not found in this institution");
  }

  return successResponse(res, "Token valid", { 
    role: "teacher",
    schoolId: teacher.schoolId,
    teacher: safeTeacher(teacher)
  });
});

// GET /api/auth/teacher/profile - MULTI-TENANT
export const profile = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({
    _id: req.user.id,
    schoolId: req.schoolId  // ✅ Verify school match
  }).populate('assignedClasses.class', 'className sections');
  
  if (!teacher) {
    throw new NotFoundError("Teacher not found in this institution");
  }
  
  return successResponse(res, "Profile retrieved successfully", { 
    teacher: safeTeacher(teacher) 
  });
});

// PUT /api/auth/teacher/profile - MULTI-TENANT
export const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ["name", "phone", "address", "gender", "dateOfBirth", "department", "subjects"];
  const updates = {};

  for (const key of allowedFields) {
    if (key in req.body) {
      // ✅ Convert comma-separated subjects string to Array
      if (key === 'subjects' && typeof req.body[key] === 'string') {
        updates[key] = req.body[key].split(',').map(s => s.trim()).filter(Boolean);
      } else {
        updates[key] = req.body[key];
      }
    }
  }

  if (req.file) {
    updates.profilePicture = req.file.filename;
    console.log("✅ Profile picture uploaded:", req.file.filename);
  }

  const updatedTeacher = await Teacher.findOneAndUpdate(
    { 
      _id: req.user.id, 
      schoolId: req.schoolId  // ✅ Verify school match
    },
    updates, 
    { new: true, runValidators: true }
  ).populate('assignedClasses.class', 'className sections');
  
  if (!updatedTeacher) {
    throw new NotFoundError("Teacher not found in this institution");
  }

  return successResponse(res, "Profile updated successfully", { 
    teacher: safeTeacher(updatedTeacher) 
  });
});

// PUT /api/auth/teacher/change-password - MULTI-TENANT
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    throw new ValidationError("Both current and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ValidationError("New password must be at least 6 characters long");
  }

  const teacher = await Teacher.findOne({
    _id: req.user.id,
    schoolId: req.schoolId  // ✅ Verify school match
  }).select("+password");
  
  if (!teacher) {
    throw new NotFoundError("Teacher not found in this institution");
  }

  const isMatch = await bcrypt.compare(currentPassword, teacher.password);
  
  if (!isMatch) {
    throw new ValidationError("Current password is incorrect");
  }

  teacher.password = await bcrypt.hash(newPassword, 10);
  await teacher.save();

  console.log("🔑 Password changed for teacher:", {
    teacherID: teacher.teacherID,
    schoolId: teacher.schoolId,
    timestamp: new Date().toISOString()
  });

  return successResponse(res, "Password changed successfully");
});

// POST /api/auth/teacher/logout
export const logout = asyncHandler(async (req, res) => {
  console.log("🔓 Teacher logout:", {
    teacherId: req.user?.id,
    schoolId: req.schoolId,
    timestamp: new Date().toISOString()
  });
  
  return successResponse(res, "Logged out successfully");
});

// Additional security helper function (optional)
export const checkTeacherSchoolAccess = asyncHandler(async (req, res, next) => {
  // Middleware to verify teacher has access to requested school
  const requestedSchoolId = req.params.schoolId || req.body.schoolId;
  
  if (requestedSchoolId && requestedSchoolId.toString() !== req.schoolId.toString()) {
    throw new AuthenticationError("Access denied to this institution");
  }
  
  next();
});

export default {
  login,
  validate,
  profile,
  updateProfile,
  changePassword,
  logout,
  checkTeacherSchoolAccess
};