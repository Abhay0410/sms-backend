// controllers/auth/parent.auth.controller.js - MULTI-TENANT VERSION
import bcrypt from "bcryptjs";
import Parent from "../../models/Parent.js";
import { signToken } from "../../utils/jwt.js";
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { AuthenticationError, ValidationError, NotFoundError } from "../../utils/errors.js";

// Helper to remove sensitive data and include schoolId
const safeParent = (parent) => {
  const obj = parent.toObject();
  delete obj.password;
  return obj;
};

// LOGIN - include schoolId in token
export const login = asyncHandler(async (req, res) => {
  const { parentID, password } = req.body || {};
  
  if (!parentID || !password) {
    throw new ValidationError("parentID and password are required");
  }

  const parent = await Parent.findOne({ parentID })
    .select("+password")
    .populate('children', 'name studentID className section status');
  
  if (!parent) {
    throw new AuthenticationError("Invalid credentials");
  }

  if (!parent.isActive) {
    throw new AuthenticationError("Account is inactive. Please contact administrator.");
  }

  const isMatch = await bcrypt.compare(password, parent.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Invalid credentials");
  }

  parent.lastLogin = new Date();
  await parent.save();

  // ✅ Include schoolId in JWT payload for multi-tenancy
  const token = signToken({ 
    id: parent._id.toString(), 
    role: "parent",
    schoolId: parent.schoolId // Assumes Parent model has schoolId field
  });

  return successResponse(res, "Login successful", {
    token,
    role: "parent",
    parent: safeParent(parent),
  });
});

// VALIDATE - verify parent exists and belongs to school from token
export const validate = asyncHandler(async (req, res) => {
  const parent = await Parent.findOne({
    _id: req.user.id,
    schoolId: req.schoolId
  }).populate('children', 'name studentID className section status');
  
  if (!parent) {
    throw new NotFoundError("Parent");
  }

  return successResponse(res, "Token valid", { 
    role: "parent",
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
    schoolId: req.schoolId
  }).populate('children', 'name studentID className section status rollNumber email phone');
  
  if (!parent) {
    throw new NotFoundError("Parent");
  }

  return successResponse(res, "Profile retrieved successfully", {
    parent: safeParent(parent),
  });
});

// GET CHILDREN - fetch children of parent scoped by schoolId
export const getChildren = asyncHandler(async (req, res) => {
  const parent = await Parent.findOne({
    _id: req.user.id,
    schoolId: req.schoolId
  }).populate({
    path: 'children',
    select: 'name studentID className section status rollNumber email phone profilePicture academicYear'
  });

  if (!parent) {
    throw new NotFoundError("Parent");
  }

  return successResponse(res, "Children retrieved successfully", {
    children: parent.children || [],
  });
});

// UPDATE PROFILE - scoped by schoolId
export const updateProfile = asyncHandler(async (req, res) => {
  const parent = await Parent.findOne({
    _id: req.user.id,
    schoolId: req.schoolId
  });

  if (!parent) {
    throw new NotFoundError("Parent");
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
    schoolId: req.schoolId
  }).select("+password");

  if (!parent) {
    throw new NotFoundError("Parent");
  }

  const isMatch = await bcrypt.compare(currentPassword, parent.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Current password is incorrect");
  }

  parent.password = await bcrypt.hash(newPassword, 10);
  await parent.save();

  return successResponse(res, "Password changed successfully");
});

// LOGOUT
export const logout = asyncHandler(async (req, res) => {
  return successResponse(res, "Logged out successfully");
});

export default {
  login,
  validate,
  profile,
  getChildren,
  updateProfile,
  changePassword,
  logout
};
