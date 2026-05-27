import bcrypt from "bcryptjs";
import SuperAdmin from "../../models/SuperAdmin.js";
import { signToken } from "../../utils/jwt.js";
import { successResponse } from "../../utils/response.js";
import { ValidationError, AuthenticationError } from "../../utils/errors.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import logger from "../../utils/logger.js";

// POST /api/superadmin/auth/setup
// @desc One-time setup: Create the first Super Admin if none exists
export const setupInitialSuperAdmin = asyncHandler(async (req, res) => {
  const count = await SuperAdmin.countDocuments();
  if (count > 0) {
    throw new ValidationError("Initial setup is locked. A Super Admin already exists.");
  }

  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new ValidationError("Name, email, and password are required.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  const superAdmin = await SuperAdmin.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: 'superadmin'
  });

  logger.info("Initial Super Admin created successfully", { email: superAdmin.email });

  return successResponse(
    res, 
    "Initial Super Admin created successfully. You can now login.", 
    { admin: { name: superAdmin.name, email: superAdmin.email } }, 
    201
  );
});

// POST /api/superadmin/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError("Email and password are required");
  }

  const admin = await SuperAdmin.findOne({ email: email.toLowerCase() }).select("+password");
  
  if (!admin) {
    throw new AuthenticationError("Invalid Super Admin credentials");
  }

  if (!admin.isActive) {
    throw new AuthenticationError("This Super Admin account has been deactivated");
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    throw new AuthenticationError("Invalid Super Admin credentials");
  }

  admin.lastLogin = new Date();
  await admin.save();

  const token = signToken({
    id: admin._id.toString(),
    role: admin.role,
    isSuperAdmin: true // Explicitly flag this token as belonging to platform owner
  });

  logger.info("Super Admin login successful", {
    adminId: admin._id,
    email: admin.email,
    ip: req.ip
  });

  return successResponse(res, "Login successful", {
    token,
    role: admin.role,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      lastLogin: admin.lastLogin
    }
  });
});

// GET /api/superadmin/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
  const admin = req.superAdmin; // Attached by the superAdminAuth middleware
  
  return successResponse(res, "Profile retrieved successfully", {
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      lastLogin: admin.lastLogin
    }
  });
});

// POST /api/superadmin/auth/logout
export const logout = asyncHandler(async (req, res) => {
  logger.info("Super Admin logout", {
    adminId: req.superAdmin?._id,
    timestamp: new Date().toISOString()
  });
  
  // JWT is stateless; client deletes the token.
  // We return a standard success response.
  return successResponse(res, "Logged out successfully");
});