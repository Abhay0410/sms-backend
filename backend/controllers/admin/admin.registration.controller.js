import bcrypt from "bcryptjs";
import Admin from "../../models/Admin.js";
import School from "../../models/School.js";
import { ValidationError, NotFoundError } from "../../utils/errors.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { generateSecurePassword } from "../../utils/password.js";
import { z } from "zod";
import { deleteFromCloudinary } from "../../utils/cloudinary.js";
import { checkStaffLimit, updateStorageUsed } from "../../utils/limits.js";

const registerAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone is required"),
  schoolId: z.string().min(1, "School ID is required")
}).passthrough();

export const registerAdmin = async (req, res) => {
  try {
    const validatedData = registerAdminSchema.parse(req.body);
    const {
      name,
      email,
      phone,
      schoolId,
      gender,
      designation,
      department,
      role,
      isActive = true,
      dateOfBirth,
      joiningDate,
      address,
    } = validatedData;

    const school = await School.findById(schoolId);
    if (!school) throw new NotFoundError("School not found");

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) throw new ValidationError("Admin already exists");

    await checkStaffLimit(schoolId, 1);

    // 🔐 password
    const passwordPlain = generateSecurePassword();
    const passwordHash = await bcrypt.hash(passwordPlain, 10);

    // 🆔 adminID - ROBUST GENERATION
    const year = new Date().getFullYear().toString().slice(-2);

    // Find the highest admin ID for THIS SCHOOL to determine the next number
    const lastAdmin = await Admin.findOne({ schoolId })
      .sort({ adminID: -1 }) // Sort by adminID descending to find the last one
      .lean();
      
    let nextAdminNumber = 1;
    if (lastAdmin && lastAdmin.adminID) {
      // Extracts the numeric part of the ID, assuming format ADMYYXXX
      const match = lastAdmin.adminID.match(/\d{3}$/);
      if (match) {
        nextAdminNumber = parseInt(match[0], 10) + 1;
      }
    }
    
    let adminID = `ADM${year}${String(nextAdminNumber).padStart(3, "0")}`;
    
    // Double-check to prevent race condition collisions
    let idExists = await Admin.findOne({ adminID, schoolId }).lean();
    while (idExists) {
      nextAdminNumber++;
      adminID = `ADM${year}${String(nextAdminNumber).padStart(3, "0")}`;
      idExists = await Admin.findOne({ adminID, schoolId }).lean();
    }

    let parsedAddress = {};

if (address) {
  try {
    parsedAddress = JSON.parse(address);
  } catch (e) {
    throw new ValidationError("Invalid address format");
  }
}


    // 🖼️ IMAGE UPLOAD
    let profilePicture = "";
    let profilePicturePublicId = "";

    if (req.file) {
      profilePicture = req.file.path;
      profilePicturePublicId = req.file.filename;
    }

    const parsedDOB =
      dateOfBirth && !isNaN(new Date(dateOfBirth))
        ? new Date(dateOfBirth)
        : null;

    const parsedJoiningDate =
      joiningDate && !isNaN(new Date(joiningDate))
        ? new Date(joiningDate)
        : new Date();

    const isSuperAdminParsed = req.body.isSuperAdmin === "true" || req.body.isSuperAdmin === true;

    await Admin.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: passwordHash,
      adminID,
      schoolId,

      dateOfBirth: parsedDOB,
      joiningDate: parsedJoiningDate,
     

      gender,
      designation,
      department,
      address: parsedAddress,

      profilePicture,
      profilePicturePublicId,

      role: role || "admin",
      isActive,
      isSuperAdmin: isSuperAdminParsed,
    });
    
    if (req.file && req.file.size) {
      await updateStorageUsed(schoolId, req.file.size);
    }
    

    return res.status(HTTP_STATUS.CREATED).json({
  success: true,
  message: "Admin registered successfully",
  data: {
   adminID,
    password: passwordPlain,
    }  // send the whole admin object
});

  } catch (error) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Parse address safely
    let parsedAddress = {};
    if (req.body.address) {
      try {
      
parsedAddress = {
  street: req.body.address
};

      } catch (e) {
        throw new ValidationError("Invalid address format");
      }
    }

    // 2️⃣ Build update object
    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      designation: req.body.designation,
      department: req.body.department,
      gender: req.body.gender,
      address: parsedAddress,
    };

    // 3️⃣ Parse DOB if sent
    if (req.body.dob) {
      updateData.dateOfBirth = new Date(req.body.dob);
    }

    // 4️⃣ Handle photo upload
    if (req.file) {
      const existingAdmin = await Admin.findOne({ adminID: req.params.id });
      if (existingAdmin && existingAdmin.profilePicturePublicId) {
        await deleteFromCloudinary(existingAdmin.profilePicturePublicId);
      }
      updateData.profilePicture = req.file.path;
      updateData.profilePicturePublicId = req.file.filename;
    }

    // 5️⃣ Update admin
    const admin = await Admin.findOneAndUpdate({adminID: id}, updateData, { new: true });
    if (admin && req.file && req.file.size) {
      await updateStorageUsed(admin.schoolId, req.file.size);
    }
    if (!admin) throw new NotFoundError("Admin not found");

    res.json({
      success: true,
      message: "Admin updated successfully",
      data: admin,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      success: false,
      message: err.message || "Update failed",
    });
  }
};
