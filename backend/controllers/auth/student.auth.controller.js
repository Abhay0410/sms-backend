// controllers/auth/student.auth.controller.js - MULTI-TENANT VERSION (UPDATED)
import bcrypt from "bcryptjs";
import Student from "../../models/Student.js";
import { signToken } from "../../utils/jwt.js";
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { AuthenticationError, ValidationError, NotFoundError } from "../../utils/errors.js";

// Helper to remove sensitive data
const safeStudent = (student) => {
  if (!student) return null;
  
  const obj = student.toObject ? student.toObject() : student;
  delete obj.password;
  
  return {
    id: obj._id || obj.id,
    studentID: obj.studentID,
    name: obj.name,
    email: obj.email,
    phone: obj.phone,
    dateOfBirth: obj.dateOfBirth,
    gender: obj.gender,
    bloodGroup: obj.bloodGroup,
    nationality: obj.nationality,
    address: obj.address,
    profilePicture: obj.profilePicture,
    className: obj.className,
    section: obj.section,
    rollNumber: obj.rollNumber,
    class: obj.class,
    parent: obj.parent,
    status: obj.status,
    role: obj.role,
    schoolId: obj.schoolId,
    isActive: obj.isActive,
    lastLogin: obj.lastLogin,
    academicYear: obj.academicYear,
    medicalHistory: obj.medicalHistory,
    allergies: obj.allergies,
    emergencyContact: obj.emergencyContact,
    transportRequired: obj.transportRequired,
    busRoute: obj.busRoute,
    pickupPoint: obj.pickupPoint,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

// ✅ LOGIN - include schoolId in token AND require schoolId in login query
export const login = asyncHandler(async (req, res) => {
  const { studentID, password, schoolId } = req.body || {};
  
  if (!studentID || !password || !schoolId) {
    throw new ValidationError("studentID, password, and schoolId are required");
  }

  // ✅ FIX: Query MUST include schoolId to ensure tenant isolation
  const student = await Student.findOne({ 
    studentID, 
    schoolId // This ensures student can only login to their own school
  }).select("+password");
  
  if (!student) {
    throw new AuthenticationError("Invalid credentials for this institution.");
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

  // Verify that the schoolId in token matches the student's schoolId
  if (student.schoolId.toString() !== schoolId.toString()) {
    throw new AuthenticationError("Unauthorized access to this institution.");
  }

  // Update last login
  student.lastLogin = new Date();
  await student.save();

  // ✅ MULTI-TENANT: Include schoolId in JWT payload
  const token = signToken({ 
    id: student._id.toString(), 
    role: "student",
    schoolId: student.schoolId.toString() // Ensure string format
  });

  // Set HTTP-only cookie for browser requests (for downloads etc.)
  res.cookie("studentToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  console.log("🔐 Student login successful:", {
    studentID: student.studentID,
    schoolId: student.schoolId,
    className: student.className,
    section: student.section,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  return successResponse(res, "Login successful", {
    token,
    role: "student",
    schoolId: student.schoolId,
    student: safeStudent(student),
  });
});

// ✅ GET PROFILE - scoped by schoolId
export const getProfile = asyncHandler(async (req, res) => {
  const student = await Student.findOne({
    _id: req.user.id,
    schoolId: req.schoolId // ✅ Verify school match
  })
    .select('-password')
    .populate('class', 'className sections')
    .populate('parent', 'name parentID phone email');
  
  if (!student) {
    throw new NotFoundError("Student not found in this institution");
  }

  return successResponse(res, "Profile retrieved successfully", {
    student: safeStudent(student),
  });
});

// ✅ UPDATE PROFILE - scoped by schoolId
export const updateProfile = asyncHandler(async (req, res) => {
  const student = await Student.findOne({
    _id: req.user.id,
    schoolId: req.schoolId // ✅ Verify school match
  });

  if (!student) {
    throw new NotFoundError("Student not found in this institution");
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
    console.log("✅ Student profile picture uploaded:", req.file.filename);
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
    schoolId: req.schoolId // ✅ Verify school match
  }).select("+password");

  if (!student) {
    throw new NotFoundError("Student not found in this institution");
  }

  const isMatch = await bcrypt.compare(currentPassword, student.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Current password is incorrect");
  }

  student.password = await bcrypt.hash(newPassword, 10);
  await student.save();

  console.log("🔑 Password changed for student:", {
    studentID: student.studentID,
    schoolId: student.schoolId,
    className: student.className,
    timestamp: new Date().toISOString()
  });

  return successResponse(res, "Password changed successfully");
});

// ✅ LOGOUT
export const logout = asyncHandler(async (req, res) => {
  console.log("🔓 Student logout:", {
    studentId: req.user?.id,
    schoolId: req.schoolId,
    timestamp: new Date().toISOString()
  });
  
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
    schoolId: req.schoolId // ✅ Verify school match
  })
    .select('-password')
    .populate('class', 'className sections')
    .populate('parent', 'name parentID');
  
  if (!student) {
    throw new NotFoundError("Student not found in this institution");
  }
  
  return successResponse(res, "Token is valid", {
    student: safeStudent(student)
  });
});

// ✅ Additional security helper (optional)
export const checkStudentSchoolAccess = asyncHandler(async (req, res, next) => {
  // Middleware to verify student has access to requested school
  const requestedSchoolId = req.params.schoolId || req.body.schoolId;
  
  if (requestedSchoolId && requestedSchoolId.toString() !== req.schoolId.toString()) {
    throw new AuthenticationError("Access denied to this institution");
  }
  
  next();
});

// ✅ Get student by ID (for admin/teacher use, with school verification)
export const getStudentById = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId // ✅ Ensure student belongs to same school
  })
    .select('-password')
    .populate('class', 'className sections')
    .populate('parent', 'name parentID phone email');
  
  if (!student) {
    throw new NotFoundError("Student not found in this institution");
  }
  
  return successResponse(res, "Student retrieved successfully", {
    student: safeStudent(student),
  });
});

export default {
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  validateToken,
  checkStudentSchoolAccess,
  getStudentById
};