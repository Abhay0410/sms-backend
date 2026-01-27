// import bcrypt from 'bcryptjs';
// import Admin from '../../models/Admin.js';
// import School from '../../models/School.js';
// import { uploadToCloudinary } from '../../utils/cloudinaryUpload.js';
// import { asyncHandler } from '../../middleware/errorHandler.js';
// import { ValidationError, NotFoundError } from '../../utils/errors.js';
// import { HTTP_STATUS } from '../../constants/httpStatus.js';

// export const registerAdmin = asyncHandler(async (req, res) => {

//   console.log("FILE 👉", req.file);

//   const {
//   name,
//   email,
//   phone,
//   isSuperAdmin = false,
//   schoolId,
//   address,
//   permissions,
//   role,
//   joiningDate,
//   dateOfBirth,
//   gender,
//   designation,
//   department,
//   isActive = true,
// } = req.body;


//   if (!name || !email || !phone || !schoolId) {
//     throw new ValidationError('Name, email, phone, and schoolId are required');
//   }

//   const school = await School.findById(schoolId);
//   if (!school) throw new NotFoundError('School not found');

//   const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
//   if (existingAdmin) throw new ValidationError('Admin already exists with this email');

//   // 🔹 Generate Password
//   const generateAdminPassword = () => `Admin@${Math.floor(100 + Math.random() * 900)}`;
//   const generatedPassword = generateAdminPassword();
//   const hashedPassword = await bcrypt.hash(generatedPassword, 10);

//   let profilePictureData = {};

// if (req.file) {
//   profilePictureData = await uploadToCloudinary(req.file.path, 'school-management');
// }



//   // 🔹 FIX: Correct AdminID Generation (Multi-tenant style)
//   const generateAdminID = async (sId) => {
//     const year = new Date().getFullYear().toString().slice(-2);
//     // Count admins only for THIS school to keep IDs organized
//     const count = await Admin.countDocuments({ schoolId: sId });
//     const nextNum = (count + 1).toString().padStart(3, '0');
//     return `ADM${year}${nextNum}`; // e.g., ADM25001
//   };
  
//   const adminID = await generateAdminID(schoolId);

//   let parsedJoiningDate = new Date();

// if (joiningDate) {
//   const temp = new Date(joiningDate);

//   if (!isNaN(temp.getTime())) {
//     parsedJoiningDate = temp;
//   }
// }

//  let parsedDateOfBirth = new Date();

// if (dateOfBirth) {
//   const temp = new Date(dateOfBirth);

//   if (!isNaN(temp.getTime())) {
//     parsedDateOfBirth = temp;
//   }
// }


//   const newAdmin = new Admin({
//     name,
//     email: email.toLowerCase(),
//     password: hashedPassword,
//     phone,
//     dateOfBirth: parsedDateOfBirth,
//     gender,
//     designation,
//     department,
//     address,
//     permissions: permissions || [],
//     schoolId,
//     adminID,
//     isSuperAdmin: false, // Security: Only seed script should set true
//     isActive,
//     joiningDate: parsedJoiningDate,
//     role: role || 'admin',
//   });

//   await newAdmin.save();

//   // return res.status(HTTP_STATUS.CREATED).json({
//   //   success: true,
//   //   message: 'Admin created successfully',
//   //   data: {
//   //     adminID: newAdmin.adminID,
//   //     name: newAdmin.name,
//   //     email: newAdmin.email,
//   //     password: generatedPassword, // For sharing with the new user
//   //   },
//   // });

// return res.status(HTTP_STATUS.CREATED).json({
//   success: true,
//   message: 'Admin created successfully',
//   data: {
//     _id: newAdmin._id,
//     adminID: newAdmin.adminID,
//     name: newAdmin.name,
//     email: newAdmin.email,
//     phone: newAdmin.phone,

//     dateOfBirth: newAdmin.dateOfBirth,
//     gender: newAdmin.gender,
//     designation: newAdmin.designation,
//     department: newAdmin.department,
//     joiningDate: newAdmin.joiningDate,

//     address: newAdmin.address,
//     profilePicture: newAdmin.profilePicture,
//     role: newAdmin.role,
//     isActive: newAdmin.isActive,

//     password: generatedPassword,
//   },
// });

// });




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
    const passwordPlain = `Admin@${Math.floor(100 + Math.random() * 900)}`;
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

    const isSuperAdminParsed = req.body.isSuperAdmin === "true";

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
  data: admin, // send the whole admin object
});

  } catch (error) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// export const updateAdmin = async (req, res) => {
//   try {
//     const { id } = req.params;

//     let parsedAddress = {};
//     if (req.body.address) {
//       parsedAddress = JSON.parse(req.body.address);
//     }

// // Convert DOB
// if (req.body.dob) {
//   updateData.dateOfBirth = new Date(req.body.dob);
//   delete updateData.dob;
// }


//     const updateData = {
//       ...req.body,
//       address: parsedAddress,
//     };

//     if (req.file) {
//       const cloud = await uploadToCloudinary(req.file.path, "sms/admins");
//       updateData.profilePicture = cloud.url;
//       updateData.profilePicturePublicId = cloud.publicId;
//     }

//     const admin = await Admin.findByIdAndUpdate(
//       id,
//       updateData,
//       { new: true }
//     );

//     if (!admin) throw new Error("Admin not found");

//     res.json({
//       success: true,
//       message: "Admin updated successfully",
//       data: admin,
//     });
//   } catch (err) {
//     res.status(400).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

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
