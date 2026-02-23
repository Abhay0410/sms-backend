import bcrypt from "bcryptjs";
import Admin from "../../models/Admin.js";
import School from "../../models/School.js";
import { uploadToCloudinary } from "../../utils/cloudinaryUpload.js";
import { ValidationError, NotFoundError } from "../../utils/errors.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";

export const registerAdmin = async (req, res) => {
  try {
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
    } = req.body;

   

    if (!name || !email || !phone || !schoolId) {
      throw new ValidationError("Required fields missing");
    }

    const school = await School.findById(schoolId);
    if (!school) throw new NotFoundError("School not found");

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) throw new ValidationError("Admin already exists");

    // 🔐 password
    let passwordPlain;
    if (designation === 'Librarian') passwordPlain = `Lib@${Math.floor(1000 + Math.random() * 9000)}`;
    else if (designation === 'Accountant') passwordPlain = `Acc@${Math.floor(1000 + Math.random() * 9000)}`;
    else passwordPlain = `Admin@${Math.floor(100 + Math.random() * 900)}`;

    const passwordHash = await bcrypt.hash(passwordPlain, 10);

    // 🆔 adminID
    const count = await Admin.countDocuments({ schoolId });
    const year = new Date().getFullYear().toString().slice(-2);
    const adminID = `ADM${year}${String(count + 1).padStart(3, "0")}`;

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
      const cloudRes = await uploadToCloudinary(
        req.file.path,
        "sms/admins"
      );

      profilePicture = cloudRes.url;
      profilePicturePublicId = cloudRes.publicId;
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

    const admin = await Admin.create({
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
      const cloud = await uploadToCloudinary(req.file.path, "sms/admins");
      updateData.profilePicture = cloud.url;
      updateData.profilePicturePublicId = cloud.publicId;
    }

    // 5️⃣ Update admin
    const admin = await Admin.findOneAndUpdate({adminID:req.params.id}, updateData, { new: true });
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
