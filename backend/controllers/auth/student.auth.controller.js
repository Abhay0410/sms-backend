// controllers/auth/student.auth.controller.js - MULTI-TENANT VERSION
import bcrypt from "bcryptjs";
import Student from "../../models/Student.js";
import { signToken } from "../../utils/jwt.js";
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { AuthenticationError, ValidationError, NotFoundError } from "../../utils/errors.js";
import { upload } from "../../middleware/upload.js";

// Helper to remove sensitive data
const safeStudent = (student) => {
  const obj = student.toObject();
  delete obj.password;
  return obj;
};

// ✅ LOGIN - include schoolId in token
export const login = asyncHandler(async (req, res) => {
  const { studentID, password ,schoolId } = req.body || {};
  
  if (!studentID || !password || !schoolId) {
    throw new ValidationError("studentID and password are required");
  }

  const student = await Student.findOne({ studentID,schoolId}).select("+password");
  
  if (!student) {
    throw new AuthenticationError("Invalid credentials");
  }

  // ✅ Allow both REGISTERED and ENROLLED students to login
  if (!student.isActive) {
    throw new AuthenticationError("Account is inactive. Please contact administrator.");
  }

  // Block only suspended/withdrawn
  if (['SUSPENDED', 'WITHDRAWN'].includes(student.status)) {
    throw new AuthenticationError(`Account status: ${student.status}. Please contact administrator.`);
  }

  const isMatch = await bcrypt.compare(password, student.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Invalid credentials");
  }

  // Update last login
  student.lastLogin = new Date();
  await student.save();

  // ✅ MULTI-TENANT: Include schoolId in JWT payload
  const token = signToken({ 
    id: student._id.toString(), 
    role: "student",
    schoolId: student.schoolId  // Assumes Student model has schoolId field
  });

  // Set HTTP-only cookie for browser requests (for downloads etc.)
  res.cookie("studentToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return successResponse(res, "Login successful", {
    token,
    role: "student",
    student: safeStudent(student),
  });
});

// ✅ GET PROFILE - scoped by schoolId
export const getProfile = asyncHandler(async (req, res) => {
  const student = await Student.findOne({
    _id: req.user.id,
    schoolId: req.schoolId
  })
    .select('-password')
    .populate('class', 'className sections');
  
  if (!student) {
    throw new NotFoundError("Student not found");
  }

  return successResponse(res, "Profile retrieved successfully", {
    student: safeStudent(student),
  });
});

// ✅ UPDATE PROFILE - scoped by schoolId
export const updateProfile = asyncHandler(async (req, res) => {
  const student = await Student.findOne({
    _id: req.user.id,
    schoolId: req.schoolId
  });

  if (!student) {
    throw new NotFoundError("Student not found");
  }

  const {
    phone,
    email,
    bloodGroup,
    nationality,
    medicalHistory,
    allergies,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
    transportRequired,
    busRoute,
    pickupPoint,
  } = req.body;

  // Update allowed fields
  if (phone) student.phone = phone;
  if (email) student.email = email;
  if (bloodGroup) student.bloodGroup = bloodGroup;
  if (nationality) student.nationality = nationality;
  
  // Medical info
  if (medicalHistory !== undefined) student.medicalHistory = medicalHistory;
  if (allergies !== undefined) {
    student.allergies = typeof allergies === 'string' 
      ? allergies.split(',').map(a => a.trim()) 
      : allergies;
  }
  
  // Emergency contact
  if (emergencyContactName || emergencyContactPhone || emergencyContactRelation) {
    student.emergencyContact = {
      name: emergencyContactName || student.emergencyContact?.name,
      phone: emergencyContactPhone || student.emergencyContact?.phone,
      relation: emergencyContactRelation || student.emergencyContact?.relation,
    };
  }

  // Transport
  if (transportRequired !== undefined) {
    student.transportRequired = transportRequired;
    if (busRoute) student.busRoute = busRoute;
    if (pickupPoint) student.pickupPoint = pickupPoint;
  }

  // Handle photo upload
  if (req.file) {
    student.profilePicture = req.file.filename;
  }

  await student.save();

  return successResponse(res, "Profile updated successfully", {
    student: safeStudent(student),
  });
});

// ✅ CHANGE PASSWORD - scoped by schoolId
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw new ValidationError("Current password and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ValidationError("New password must be at least 6 characters");
  }

  const student = await Student.findOne({
    _id: req.user.id,
    schoolId: req.schoolId
  }).select("+password");

  if (!student) {
    throw new NotFoundError("Student not found");
  }

  const isMatch = await bcrypt.compare(currentPassword, student.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Current password is incorrect");
  }

  student.password = await bcrypt.hash(newPassword, 10);
  await student.save();

  return successResponse(res, "Password changed successfully");
});

// ✅ LOGOUT
export const logout = asyncHandler(async (req, res) => {
  // Clear student cookie on logout
  res.clearCookie("studentToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  
  return successResponse(res, "Logged out successfully");
});

// ✅ VALIDATE TOKEN - scoped by schoolId
export const validateToken = asyncHandler(async (req, res) => {
  const student = await Student.findOne({
    _id: req.user.id,
    schoolId: req.schoolId
  }).select('-password');
  
  if (!student) {
    throw new NotFoundError("Student not found");
  }
  
  return successResponse(res, "Token is valid", {
    student: safeStudent(student)
  });
});

export default {
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  validateToken,
};
