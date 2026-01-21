// controllers/auth/parent.auth.controller.js - MULTI-TENANT VERSION (UPDATED)
import bcrypt from "bcryptjs";
import Parent from "../../models/Parent.js";
import { signToken } from "../../utils/jwt.js";
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { AuthenticationError, ValidationError, NotFoundError } from "../../utils/errors.js";

// Helper to remove sensitive data and include schoolId
const safeParent = (parent) => {
  if (!parent) return null;
  
  const obj = parent.toObject ? parent.toObject() : parent;
  delete obj.password;
  
  return {
    id: obj._id || obj.id,
    parentID: obj.parentID,
    name: obj.name,
    email: obj.email,
    phone: obj.phone,
    occupation: obj.occupation,
    qualification: obj.qualification,
    address: obj.address,
    profilePicture: obj.profilePicture,
    children: obj.children,
    role: obj.role,
    schoolId: obj.schoolId,
    isActive: obj.isActive,
    lastLogin: obj.lastLogin,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

// LOGIN - include schoolId in token AND require schoolId in login query
export const login = asyncHandler(async (req, res) => {
  // ✅ FIX: Extract schoolId from request body - REQUIRED for tenant isolation
  const { parentID, password, schoolId } = req.body || {};
  
  if (!parentID || !password || !schoolId) {
    throw new ValidationError("parentID, password, and schoolId are required");
  }

  // ✅ FIX: Query MUST include schoolId to ensure tenant isolation
  const parent = await Parent.findOne({ 
    parentID, 
    schoolId // This ensures parent can only login to their own school
  })
    .select("+password")
    .populate('children', 'name studentID className section status');
  
  if (!parent) {
    throw new AuthenticationError("Invalid credentials for this institution.");
  }

  if (!parent.isActive) {
    throw new AuthenticationError("Account is inactive. Please contact administrator.");
  }

  const isMatch = await bcrypt.compare(password, parent.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Invalid credentials");
  }

  // Verify that the schoolId in token matches the parent's schoolId
  if (parent.schoolId.toString() !== schoolId.toString()) {
    throw new AuthenticationError("Unauthorized access to this institution.");
  }

  parent.lastLogin = new Date();
  await parent.save();

  // ✅ Include schoolId in JWT payload for multi-tenancy
  const token = signToken({ 
    id: parent._id.toString(), 
    role: "parent",
    schoolId: parent.schoolId.toString() // Ensure string format
  });

  console.log("🔐 Parent login successful:", {
    parentID: parent.parentID,
    schoolId: parent.schoolId,
    childrenCount: parent.children?.length || 0,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  return successResponse(res, "Login successful", {
    token,
    role: "parent",
    schoolId: parent.schoolId,
    parent: safeParent(parent),
  });
});

// VALIDATE - verify parent exists and belongs to school from token
export const validate = asyncHandler(async (req, res) => {
  const parent = await Parent.findOne({
    _id: req.user.id,
    schoolId: req.schoolId // ✅ Verify school match
  }).populate('children', 'name studentID className section status');
  
  if (!parent) {
    throw new NotFoundError("Parent not found in this institution");
  }

  return successResponse(res, "Token valid", { 
    role: "parent",
    schoolId: parent.schoolId,
    parent: safeParent(parent)
  });
});

// PROFILE - fetch parent profile scoped by schoolId
export const profile = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.id) {
    throw new AuthenticationError("User not authenticated");
  }
  
  const parent = await Parent.findOne({
    _id: req.user.id,
    schoolId: req.schoolId // ✅ Verify school match
  }).populate('children', 'name studentID className section status rollNumber email phone');
  
  if (!parent) {
    throw new NotFoundError("Parent not found in this institution");
  }

  return successResponse(res, "Profile retrieved successfully", {
    parent: safeParent(parent),
  });
});

// GET CHILDREN - fetch children of parent scoped by schoolId
export const getChildren = asyncHandler(async (req, res) => {
  const parent = await Parent.findOne({
    _id: req.user.id,
    schoolId: req.schoolId // ✅ Verify school match
  }).populate({
    path: 'children',
    select: 'name studentID className section status rollNumber email phone profilePicture academicYear',
    match: { schoolId: req.schoolId } // ✅ Ensure children belong to same school
  });

  if (!parent) {
    throw new NotFoundError("Parent not found in this institution");
  }

  // Filter out any children that might not belong to this school
  const children = (parent.children || []).filter(child => 
    child && child.schoolId && child.schoolId.toString() === req.schoolId.toString()
  );

  return successResponse(res, "Children retrieved successfully", {
    children,
  });
});

// UPDATE PROFILE - scoped by schoolId
export const updateProfile = asyncHandler(async (req, res) => {
  const parent = await Parent.findOne({
    _id: req.user.id,
    schoolId: req.schoolId // ✅ Verify school match
  });

  if (!parent) {
    throw new NotFoundError("Parent not found in this institution");
  }

  const allowedFields = ["name", "phone", "occupation", "qualification"];
  
  if (req.body.address) {
    if (typeof req.body.address === 'string') {
      parent.address = { street: req.body.address };
    } else {
      parent.address = {
        ...parent.address,
        ...req.body.address
      };
    }
  }
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      parent[field] = req.body[field];
    }
  });

  if (req.file) {
    parent.profilePicture = req.file.filename;
    console.log("✅ Parent profile picture uploaded:", req.file.filename);
  }

  await parent.save();

  return successResponse(res, "Profile updated successfully", {
    parent: safeParent(parent),
  });
});

// CHANGE PASSWORD - scoped by schoolId
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw new ValidationError("Current password and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ValidationError("New password must be at least 6 characters");
  }

  const parent = await Parent.findOne({
    _id: req.user.id,
    schoolId: req.schoolId // ✅ Verify school match
  }).select("+password");

  if (!parent) {
    throw new NotFoundError("Parent not found in this institution");
  }

  const isMatch = await bcrypt.compare(currentPassword, parent.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Current password is incorrect");
  }

  parent.password = await bcrypt.hash(newPassword, 10);
  await parent.save();

  console.log("🔑 Password changed for parent:", {
    parentID: parent.parentID,
    schoolId: parent.schoolId,
    timestamp: new Date().toISOString()
  });

  return successResponse(res, "Password changed successfully");
});

// LOGOUT
export const logout = asyncHandler(async (req, res) => {
  console.log("🔓 Parent logout:", {
    parentId: req.user?.id,
    schoolId: req.schoolId,
    timestamp: new Date().toISOString()
  });
  
  return successResponse(res, "Logged out successfully");
});

// Additional security helper (optional)
export const checkParentSchoolAccess = asyncHandler(async (req, res, next) => {
  // Middleware to verify parent has access to requested school
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
  getChildren,
  updateProfile,
  changePassword,
  logout,
  checkParentSchoolAccess
};