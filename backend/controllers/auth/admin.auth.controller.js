// controllers/auth/admin.auth.controller.js - MULTI-TENANT VERSION
import bcrypt from "bcryptjs";
import Admin from "../../models/Admin.js";
import { signToken } from "../../utils/jwt.js";
import { successResponse } from "../../utils/response.js";
import { ValidationError, AuthenticationError, NotFoundError } from "../../utils/errors.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

function safeAdmin(admin) {
  if (!admin) return null;
  const {
    _id, adminID, name, email, phone, designation, address, gender, dateOfBirth, department,
    role, profilePicture, isSuperAdmin, permissions, createdAt, updatedAt, schoolId
  } = admin;
  return {
    id: _id, adminID, name, email, phone, designation, address, gender, dateOfBirth,
    department, role, profilePicture, isSuperAdmin, permissions, schoolId, createdAt, updatedAt
  };
}

// POST /api/auth/admin/login - MULTI-TENANT
export const login = asyncHandler(async (req, res) => {
  const { adminID, password } = req.body || {};
  
  if (!adminID || !password) {
    throw new ValidationError("adminID and password are required");
  }

  // ✅ MULTI-TENANT: Find admin by adminID (unique across platform)
  const admin = await Admin.findOne({ adminID }).select("+password").lean();
  
  if (!admin) {
    throw new AuthenticationError("Invalid credentials");
  }

  if (!admin.isActive) {
    throw new AuthenticationError("Account is inactive. Please contact administrator.");
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Invalid credentials");
  }

  // Update last login
  await Admin.findByIdAndUpdate(admin._id, { lastLogin: new Date() });

  // ✅ MULTI-TENANT: Include schoolId in JWT payload
  const token = signToken({ 
    id: admin._id.toString(), 
    role: "admin", 
    schoolId: admin.schoolId,
    isSuperAdmin: admin.isSuperAdmin || false
  });

  console.log("🔐 Admin login successful:", {
    adminID: admin.adminID,
    schoolId: admin.schoolId,
    isSuperAdmin: admin.isSuperAdmin
  });

  return successResponse(
    res,
    "Login successful",
    {
      token,
      role: "admin",
      admin: safeAdmin(admin),
    }
  );
});

// POST /api/auth/admin/validate - MULTI-TENANT
export const validate = asyncHandler(async (req, res) => {
  // ✅ MULTI-TENANT: Verify admin belongs to same school
  const admin = await Admin.findOne({
    _id: req.user.id,
    schoolId: req.schoolId  // Match token schoolId
  });
  
  if (!admin) {
    throw new NotFoundError("Admin");
  }

  return successResponse(res, "Token valid", { 
    role: "admin",
    admin: safeAdmin(admin)
  });
});

// GET /api/auth/admin/profile - MULTI-TENANT
export const profile = asyncHandler(async (req, res) => {
  // ✅ MULTI-TENANT: Verify admin belongs to same school
  const admin = await Admin.findOne({
    _id: req.user.id,
    schoolId: req.schoolId  // Match token schoolId
  });
  
  if (!admin) {
    throw new NotFoundError("Admin");
  }
  
  return successResponse(res, "Profile retrieved successfully", { 
    admin: safeAdmin(admin) 
  });
});

// PUT /api/auth/admin/profile - MULTI-TENANT
export const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ["name", "phone", "designation", "address", "gender", "dateOfBirth", "department"];
  const updates = {};

  for (const key of allowedFields) {
    if (key in req.body) {
      updates[key] = req.body[key];
    }
  }

  if (req.file) {
    updates.profilePicture = req.file.filename;
    console.log("✅ Profile picture uploaded:", req.file.filename);
  }

  // ✅ MULTI-TENANT: Update only own school's admin
  const updatedAdmin = await Admin.findOneAndUpdate(
    { 
      _id: req.user.id, 
      schoolId: req.schoolId  // Match token schoolId
    },
    updates, 
    { new: true, runValidators: true }
  );
  
  if (!updatedAdmin) {
    throw new NotFoundError("Admin");
  }

  return successResponse(res, "Profile updated successfully", { 
    admin: safeAdmin(updatedAdmin) 
  });
});

// PUT /api/auth/admin/change-password - MULTI-TENANT
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  
  if (!currentPassword || !newPassword) {
    throw new ValidationError("Both current and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ValidationError("New password must be at least 6 characters long");
  }

  // ✅ MULTI-TENANT: Verify admin belongs to same school
  const admin = await Admin.findOne({
    _id: req.user.id,
    schoolId: req.schoolId  // Match token schoolId
  }).select("+password");
  
  if (!admin) {
    throw new NotFoundError("Admin");
  }

  const isMatch = await bcrypt.compare(currentPassword, admin.password);
  
  if (!isMatch) {
    throw new ValidationError("Current password is incorrect");
  }

  admin.password = await bcrypt.hash(newPassword, 10);
  await admin.save();

  return successResponse(res, "Password changed successfully");
});

// POST /api/auth/admin/logout
export const logout = asyncHandler(async (req, res) => {
  // JWT is stateless, so logout is handled client-side
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
