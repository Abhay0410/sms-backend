import bcrypt from 'bcryptjs';
import Admin from '../../models/Admin.js';
import School from '../../models/School.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

export const registerAdmin = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    isSuperAdmin = false,
    schoolId,
    address,
    permissions, // Ensure this matches schema (permissions vs permission)
    role,
    joiningDate,
    isActive = true,
  } = req.body;

  if (!name || !email || !phone || !schoolId) {
    throw new ValidationError('Name, email, phone, and schoolId are required');
  }

  const school = await School.findById(schoolId);
  if (!school) throw new NotFoundError('School not found');

  const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
  if (existingAdmin) throw new ValidationError('Admin already exists with this email');

  // 🔹 Generate Password
  const generateAdminPassword = () => `Admin@${Math.floor(100 + Math.random() * 900)}`;
  const generatedPassword = generateAdminPassword();
  const hashedPassword = await bcrypt.hash(generatedPassword, 10);

  // 🔹 FIX: Correct AdminID Generation (Multi-tenant style)
  const generateAdminID = async (sId) => {
    const year = new Date().getFullYear().toString().slice(-2);
    // Count admins only for THIS school to keep IDs organized
    const count = await Admin.countDocuments({ schoolId: sId });
    const nextNum = (count + 1).toString().padStart(3, '0');
    return `ADM${year}${nextNum}`; // e.g., ADM25001
  };
  
  const adminID = await generateAdminID(schoolId);

  const newAdmin = new Admin({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    phone,
    address,
    permissions: permissions || [],
    schoolId,
    adminID,
    isSuperAdmin: false, // Security: Only seed script should set true
    isActive,
    joiningDate: joiningDate || new Date(),
    role: role || 'admin',
  });

  await newAdmin.save();

  return res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: 'Admin created successfully',
    data: {
      adminID: newAdmin.adminID,
      name: newAdmin.name,
      email: newAdmin.email,
      password: generatedPassword, // For sharing with the new user
    },
  });
});
