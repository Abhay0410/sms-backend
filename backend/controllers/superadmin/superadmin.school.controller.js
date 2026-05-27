import School from "../../models/School.js";
import Admin from "../../models/Admin.js";
import { successResponse } from "../../utils/response.js";
import { ValidationError, NotFoundError } from "../../utils/errors.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import logger from "../../utils/logger.js";
import { signToken } from "../../utils/jwt.js";

// GET /api/superadmin/schools
// @desc Get all schools with pagination, search, and filters
export const getAllSchools = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const skip = (page - 1) * limit;
  
  const query = {};
  
  if (req.query.status) query.status = req.query.status;
  if (req.query.search) {
    query.$or = [
      { schoolName: { $regex: req.query.search, $options: 'i' } },
      { adminEmail: { $regex: req.query.search, $options: 'i' } },
      { schoolCode: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  const schools = await School.find(query)
    .select('-__v')
    .populate('subscription', 'name monthlyPrice')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();

  const total = await School.countDocuments(query);

  return res.status(200).json({
    success: true,
    message: "Schools retrieved successfully",
    data: schools,
    meta: {
      pagination: {
        currentPage: page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

// GET /api/superadmin/schools/:id
// @desc Get detailed profile of a specific school
export const getSchoolById = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id).populate('subscription');
  if (!school) throw new NotFoundError("School not found");
  
  return successResponse(res, "School details retrieved", { school });
});

// POST /api/superadmin/schools
// @desc Manually provision a new school
export const createSchool = asyncHandler(async (req, res) => {
  const { schoolName, schoolCode, adminEmail, phone, city, state, subdomain } = req.body;
  
  if (!schoolName || !schoolCode || !adminEmail || !phone || !city || !state) {
    throw new ValidationError("Missing required fields");
  }

  // Check for duplicates
  const existing = await School.findOne({ 
    $or: [{ schoolCode }, { adminEmail }, ...(subdomain ? [{ subdomain }] : [])] 
  });
  
  if (existing) {
    throw new ValidationError("School code, email, or subdomain already in use");
  }

  const school = await School.create({
    schoolName,
    schoolCode,
    adminEmail: adminEmail.toLowerCase(),
    phone,
    address: { city, state },
    subdomain: subdomain ? subdomain.toLowerCase() : undefined,
    status: 'ACTIVE',
    isActive: true
  });

  logger.info("New school manually provisioned by SuperAdmin", { 
    schoolId: school._id, 
    adminId: req.superAdmin._id 
  });

  return successResponse(res, "School provisioned successfully", { school }, 201);
});

// PATCH /api/superadmin/schools/:id/status
// @desc Suspend or Activate a school (e.g., for non-payment)
export const updateSchoolStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
    throw new ValidationError("Invalid status. Must be ACTIVE, SUSPENDED, or PENDING.");
  }

  const school = await School.findById(req.params.id);
  if (!school) throw new NotFoundError("School not found");

  school.status = status;
  // Keep legacy isActive synced for backward compatibility
  school.isActive = (status === 'ACTIVE'); 
  
  await school.save();

  // ✅ Fetch the principal's Admin ID and Email when activated
  let primaryAdmin = null;
  if (status === 'ACTIVE') {
    primaryAdmin = await Admin.findOne({ schoolId: school._id, isSuperAdmin: true, role: 'admin' }) 
                || await Admin.findOne({ schoolId: school._id, role: 'admin' });
  }

  logger.info(`School status updated`, { 
    schoolId: school._id, 
    status,
    adminId: req.superAdmin._id 
  });

  return successResponse(res, `School status updated to ${status}`, { 
    school,
    adminDetails: primaryAdmin ? {
      adminID: primaryAdmin.adminID,
      email: primaryAdmin.email,
      name: primaryAdmin.name
    } : null
  });
});

// POST /api/superadmin/schools/:id/impersonate
// @desc Generate a temporary token to log into a school as its primary admin
export const impersonateTenant = asyncHandler(async (req, res) => {
  const { id: schoolId } = req.params;

  const school = await School.findById(schoolId);
  if (!school) throw new NotFoundError("School not found");

  if (school.status === 'SUSPENDED') {
    throw new ValidationError("Cannot impersonate a suspended school. Activate the account first.");
  }

  // Find the primary admin for this school
  // Assuming 'isSuperAdmin: true' inside the Admin model denotes the tenant owner
  const admin = await Admin.findOne({ schoolId: school._id, isSuperAdmin: true, role: 'admin' }) 
             || await Admin.findOne({ schoolId: school._id, role: 'admin' }); // Fallback to any admin

  if (!admin) {
    throw new NotFoundError("No active Admin account found for this school");
  }

  // Generate the token acting as the tenant admin
  const token = signToken({
    id: admin._id.toString(),
    schoolId: school._id.toString(),
    role: admin.role,
    isSuperAdmin: admin.isSuperAdmin 
  });

  // CRITICAL: Log this highly sensitive action
  logger.warn(`🚨 TENANT IMPERSONATION TRIGGERED`, {
    superAdminId: req.superAdmin._id,
    targetSchoolId: school._id,
    targetAdminId: admin._id,
    ip: req.ip
  });

  return successResponse(res, `Impersonation successful. Logging in as ${admin.name}`, { token });
});