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
  const { teacherID, password } = req.body || {};

  if (!teacherID || !password) {
    throw new ValidationError("teacherID and password are required");
  }

  const teacher = await Teacher.findOne({ teacherID }).select("+password");
  
  if (!teacher) {
    throw new AuthenticationError("Invalid credentials");
  }

  if (!teacher.isActive) {
    throw new AuthenticationError("Account is inactive. Please contact administrator.");
  }

  const isMatch = await bcrypt.compare(password, teacher.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Invalid credentials");
  }

  // Update last login
  teacher.lastLogin = new Date();
  await teacher.save();

  // ✅ MULTI-TENANT: Include schoolId in JWT payload
  const tokenPayload = { 
    id: teacher._id.toString(), 
    role: "teacher",
    schoolId: teacher.schoolId,  // ✅ CRITICAL
    isSuperAdmin: teacher.isSuperAdmin || false  // ✅ For teacher super-admins if needed
  };
  
  console.log("🔐 Teacher Login - Generating Token:");
  console.log("  Teacher ID:", teacher._id.toString());
  console.log("  School ID:", teacher.schoolId);
  console.log("  Payload:", tokenPayload);
  
  const token = signToken(tokenPayload);
  
  console.log("  Token generated:", token.substring(0, 50) + "...");

  return successResponse(
    res,
    "Login successful",
    {
      token,
      role: "teacher",
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
    throw new NotFoundError("Teacher");
  }

  return successResponse(res, "Token valid", { 
    role: "teacher",
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
    throw new NotFoundError("Teacher");
  }
  
  return successResponse(res, "Profile retrieved successfully", { 
    teacher: safeTeacher(teacher) 
  });
});

// PUT /api/auth/teacher/profile - MULTI-TENANT
export const updateProfile = asyncHandler(async (req, res) => {
  // ✅ 1. Add 'department' to allowedFields
  const allowedFields = ["name", "phone", "address", "gender", "dateOfBirth", "department", "subjects"];
  const updates = {};

  for (const key of allowedFields) {
    if (key in req.body) {
      // ✅ 2. Convert comma-separated subjects string to Array
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
      schoolId: req.schoolId 
    },
    updates, 
    { new: true, runValidators: true }
  ).populate('assignedClasses.class', 'className sections');
  
  if (!updatedTeacher) {
    throw new NotFoundError("Teacher");
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
    throw new NotFoundError("Teacher");
  }

  const isMatch = await bcrypt.compare(currentPassword, teacher.password);
  
  if (!isMatch) {
    throw new ValidationError("Current password is incorrect");
  }

  teacher.password = await bcrypt.hash(newPassword, 10);
  await teacher.save();

  return successResponse(res, "Password changed successfully");
});

// POST /api/auth/teacher/logout
export const logout = asyncHandler(async (req, res) => {
  return successResponse(res, "Logged out successfully");
});

export default {
  login,
  validate,
  profile,
  updateProfile,
  changePassword,
  logout
};
