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
  // ✅ FIX: Extract schoolId from request body - REQUIRED for tenant isolation
  const { adminID, password, schoolId } = req.body || {};
  
  if (!adminID || !password || !schoolId) {
    throw new ValidationError("adminID, password, and schoolId are required");
  }

  // ✅ FIX: Query MUST include schoolId to ensure tenant isolation
  const admin = await Admin.findOne({ 
    adminID, 
    schoolId // This ensures admin can only login to their own school
  }).select("+password").lean();
  
  if (!admin) {
    throw new AuthenticationError("Invalid credentials for this institution.");
  }

  if (!admin.isActive) {
    throw new AuthenticationError("Account is inactive. Please contact administrator.");
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  
  if (!isMatch) {
    throw new AuthenticationError("Invalid credentials");
  }

  // Verify that the schoolId in token matches the admin's schoolId
  if (admin.schoolId.toString() !== schoolId.toString()) {
    throw new AuthenticationError("Unauthorized access to this institution.");
  }

  // Update last login
  await Admin.findByIdAndUpdate(admin._id, { lastLogin: new Date() });

  // ✅ MULTI-TENANT: Include schoolId in JWT payload
  const token = signToken({ 
    id: admin._id.toString(), 
    role: "admin", 
    designation: admin.designation, // ✅ Track specifically who they are
    schoolId: admin.schoolId.toString(), // Ensure string format
    isSuperAdmin: admin.isSuperAdmin || false
  });

  console.log("🔐 Admin login successful:", {
    adminID: admin.adminID,
    schoolId: admin.schoolId,
    isSuperAdmin: admin.isSuperAdmin,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  return successResponse(
    res,
    "Login successful",
    {
      token,
      role: "admin",
      designation: admin.designation, // ✅ Frontend isse tabs filter karega
      schoolId: admin.schoolId,
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
    throw new NotFoundError("Admin not found in this institution");
  }

  return successResponse(res, "Token valid", { 
    role: "admin",
    schoolId: admin.schoolId,
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
    throw new NotFoundError("Admin not found in this institution");
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
    updates.profilePicture = req.file.path;
    updates.profilePicturePublicId = req.file.filename;
    console.log("✅ Profile picture uploaded:", req.file.path);
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
    throw new NotFoundError("Admin not found in this institution");
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
    throw new NotFoundError("Admin not found in this institution");
  }

  const isMatch = await bcrypt.compare(currentPassword, admin.password);
  
  if (!isMatch) {
    throw new ValidationError("Current password is incorrect");
  }

  admin.password = await bcrypt.hash(newPassword, 10);
  await admin.save();

  console.log("🔑 Password changed for admin:", {
    adminID: admin.adminID,
    schoolId: admin.schoolId,
    timestamp: new Date().toISOString()
  });

  return successResponse(res, "Password changed successfully");
});

// POST /api/auth/admin/logout
export const logout = asyncHandler(async (req, res) => {
  // JWT is stateless, so logout is handled client-side
  console.log("🔓 Admin logout:", {
    adminId: req.user?.id,
    schoolId: req.schoolId,
    timestamp: new Date().toISOString()
  });
  
  return successResponse(res, "Logged out successfully");
});

// Additional security helper function (optional)
export const checkSchoolAccess = asyncHandler(async (req, res, next) => {
  // Middleware to verify admin has access to requested school
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
  checkSchoolAccess
};