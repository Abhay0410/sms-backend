// controllers/admin/admin.student.controller.js - MULTI-TENANT VERSION
import Student from '../../models/Student.js';
import Parent from '../../models/Parent.js';
import Class from '../../models/Class.js';
import mongoose from 'mongoose';
import Enrollment from '../../models/Enrollment.js';
import bcrypt from 'bcryptjs';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { getPaginationParams } from '../../utils/pagination.js';
import { generateSecurePassword } from '../../utils/password.js';
import logger from '../../utils/logger.js';
import { deleteFromCloudinary } from '../../utils/cloudinary.js';

// ✅ HELPER FUNCTION: Find class by name or numeric value (MULTI-TENANT)
async function findClassByName(className, academicYear, schoolId) {
  let classDoc = null;

  // Strategy 1: Exact match with schoolId
  classDoc = await Class.findOne({
    className: className,
    academicYear: academicYear,
    schoolId: schoolId  // ✅ MULTI-TENANT FILTER
  });

  // Strategy 2: Try with "Class " prefix
  if (!classDoc && !className.startsWith('Class ')) {
    classDoc = await Class.findOne({
      className: `Class ${className}`,
      academicYear: academicYear,
      schoolId: schoolId  // ✅ MULTI-TENANT FILTER
    });
  }

  // Strategy 3: Try by numeric value
  if (!classDoc) {
    const numericMatch = className.match(/\d+/);
    if (numericMatch) {
      classDoc = await Class.findOne({
        classNumeric: parseInt(numericMatch[0]),
        academicYear: academicYear,
        schoolId: schoolId  // ✅ MULTI-TENANT FILTER
      });
    }
  }

  // Strategy 4: Special names (Nursery, LKG, UKG, etc.)
  if (!classDoc) {
    const specialNames = {
      'nursery': 'Nursery',
      'lkg': 'LKG',
      'ukg': 'UKG',
      'kg1': 'LKG',
      'kg2': 'UKG'
    };
    
    const normalized = className.toLowerCase();
    if (specialNames[normalized]) {
      classDoc = await Class.findOne({
        className: specialNames[normalized],
        academicYear: academicYear,
        schoolId: schoolId  // ✅ MULTI-TENANT FILTER
      });
    }
  }

  return classDoc;
}

// Get all students - MULTI-TENANT
// export const getAllStudents = asyncHandler(async (req, res) => {
//   const { page, limit, skip } = getPaginationParams(req);
//   const { className, section, academicYear, status, search } = req.query;
  
//   let studentFilter = { schoolId: req.schoolId };
//   if (status) studentFilter.status = status;
//   if (search) studentFilter.$text = { $search: search };

//   let studentIds = null;
//   if (status || search) {
//     const matchedStudents = await Student.find(studentFilter).select('_id');
//     studentIds = matchedStudents.map(s => s._id);
//   }

//   let enrollFilter = { schoolId: req.schoolId, status: { $ne: 'DROPPED' } };
//   if (academicYear) enrollFilter.academicYear = academicYear;
//   if (className) enrollFilter.className = className;
//   if (section) enrollFilter.section = section;
//   if (studentIds !== null) enrollFilter.student = { $in: studentIds };
  
//   const [enrollments, total] = await Promise.all([
//     Enrollment.find(enrollFilter)
//       .populate({ path: 'student', select: '-password' })
//       .populate('class', 'className')
//       .sort({ rollNumber: 1 })
//       .skip(skip)
//       .limit(limit)
//       .lean(),
//     Enrollment.countDocuments(enrollFilter)
//   ]);
  
//   const students = enrollments.map(e => {
//     if (!e.student) return null;
//     return {
//       ...e.student,
//       class: e.class,
//       className: e.className,
//       section: e.section,
//       rollNumber: e.rollNumber,
//       academicYear: e.academicYear,
//       enrollmentId: e._id
//     };
//   }).filter(Boolean);

//   return paginatedResponse(res, 'Students retrieved successfully', students, page, limit, total);
// });

// export const getAllStudents = asyncHandler(async (req, res) => {
//   const { page, limit, skip } = getPaginationParams(req);
//   const { className, section, academicYear, status, search } = req.query;

//   const filter = {
//     schoolId: req.schoolId,
//   };

//   if (status) filter.status = status;
//   if (search) {
//     filter.$or = [
//       { name: { $regex: search, $options: "i" } },
//       { studentID: { $regex: search, $options: "i" } },
//       { email: { $regex: search, $options: "i" } },
//       { mobileNumber: { $regex: search, $options: "i" } },
//       { fatherName: { $regex: search, $options: "i" } },
//     ];
//   }

//   const [students, total] = await Promise.all([
//     Student.find(filter)
//       .select("-password")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean(),
//     Student.countDocuments(filter),
//   ]);

//   const studentIds = students.map((s) => s._id);

//   const enrollments = await Enrollment.find({
//     schoolId: req.schoolId,
//     student: { $in: studentIds },
//     status: { $ne: "DROPPED" },
//     ...(academicYear ? { academicYear } : {}),
//     ...(className ? { className } : {}),
//     ...(section ? { section } : {}),
//   })
//     .populate("class", "className")
//     .lean();

//   const enrollmentMap = new Map(
//     enrollments.map((e) => [String(e.student), e])
//   );

//   const mergedStudents = students.map((s) => {
//     const e = enrollmentMap.get(String(s._id));
//     return {
//       ...s,
//       class: e?.class || null,
//       className: e?.className || null,
//       section: e?.section || null,
//       rollNumber: e?.rollNumber || null,
//       academicYear: e?.academicYear || null,
//       enrollmentId: e?._id || null,
//     };
//   });

//   return paginatedResponse(
//     res,
//     "Students retrieved successfully",
//     mergedStudents,
//     page,
//     limit,
//     total
//   );
// });
export const getAllStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { className, section, academicYear, status, search } = req.query;

  const filter = { schoolId: req.schoolId };

  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { studentID: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { mobileNumber: { $regex: search, $options: "i" } },
      { fatherName: { $regex: search, $options: "i" } },
    ];
  }

  const [students, total] = await Promise.all([
    Student.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Student.countDocuments(filter),
  ]);

  const studentIds = students.map((s) => s._id);

  const enrollments = await Enrollment.find({
    schoolId: req.schoolId,
    student: { $in: studentIds },
    status: { $ne: "DROPPED" },
    ...(academicYear ? { academicYear } : {}),
    ...(className ? { className } : {}),
    ...(section ? { section } : {}),
  })
    .populate("class", "className")
    .lean();

  const enrollmentMap = new Map(enrollments.map((e) => [String(e.student), e]));

  const mergedStudents = students.map((s) => {
    const e = enrollmentMap.get(String(s._id));
    return {
      ...s,
      class: e?.class || null,
      className: e?.className || null,
      section: e?.section || null,
      rollNumber: e?.rollNumber || null,
      academicYear: e?.academicYear || null,
      enrollmentId: e?._id || null,
    };
  });

  return res.status(200).json({
    success: true,
    message: "Students retrieved successfully",
    data: mergedStudents,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});


// Get student by ID - MULTI-TENANT
export const getStudentById = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { academicYear } = req.query;
  
  const student = await Student.findOne({ 
    _id: studentId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
  })
      .select("-password")
  .populate("parent", "name parentID phone email")
  .populate("schoolId", "name")
  .lean();
  
  if (!student) {
    throw new NotFoundError('Student');
  }

  let enrollFilter = { schoolId: req.schoolId, student: studentId };
  if (academicYear) enrollFilter.academicYear = academicYear;

  const enrollment = await Enrollment.findOne(enrollFilter)
    .sort({ academicYear: -1, createdAt: -1 })
    .populate('class', 'className sections')
    .lean();

  if (enrollment) {
    student.class = enrollment.class;
    student.className = enrollment.className;
    student.section = enrollment.section;
    student.rollNumber = enrollment.rollNumber;
    student.academicYear = enrollment.academicYear;
    student.enrollmentId = enrollment._id;
  }
  
  return successResponse(res, 'Student retrieved successfully', student);
});

const toBoolean = (value) => {
  return value === true || value === "true";
};

// Create student with parent - MULTI-TENANT
export const createStudentWithParent = asyncHandler(async (req, res) => {
  const {
    // Student details
    studentName, studentEmail, mobileNumber, dateOfBirth, gender, bloodGroup, religion, caste,
    nationality, aadharNumber,
    
    // Address
    street, city, state, pincode, country,
    
    // Parent details
    fatherName, fatherPhone, fatherEmail, fatherOccupation,
    motherName, motherPhone, motherEmail, motherOccupation,
    guardianName, guardianPhone, guardianRelation,
    
    // Parent account details
    parentName, parentEmail, parentPhone, parentRelation,
    parentOccupation, parentQualification, parentIncome,
    
    // Academic Info
    className, section, academicYear, previousSchool, rollNumber,
    
    // Medical Info
    medicalHistory, allergies, emergencyContactName, emergencyContactPhone, emergencyContactRelation,
    
    // Transport & Hostel
    transportRequired, busRoute, pickupPoint,
    hostelResident, hostelBlock, roomNumber,

// ✅ NEW FIELDS
  enrollmentNumber,
  scholarNumber,

 

  isHandicapped,

  bankName,
  accountNumber,
  ifscCode,
  accountHolderName,
  scholarshipName,
  ssid


  } = req.body;

    // dateOfBirth: new Date(req.body.dateOfBirth),
  

  
  console.log("📝 Received student registration data:", {
    studentName,
    className,
    academicYear,
    parentName,
    parentEmail
  });
  
  // Validation
  if (!studentName || !className || !academicYear) {
    throw new ValidationError('Student name, class, and academic year are required');
  }
  
  if (!fatherName) {
    throw new ValidationError('Father name is required');
  }
  
  if (!parentName || !parentEmail || !parentPhone || !parentRelation) {
    throw new ValidationError('Parent name, email, phone, and relation are required');
  }
  
  // ✅ FIND CLASS DOCUMENT - MULTI-TENANT
  const classDoc = await findClassByName(className, academicYear, req.schoolId);
  
  if (!classDoc) {
    console.warn(`⚠️  Class not found: "${className}" for ${academicYear} in school ${req.schoolId}`);
    console.warn(`   Available classes:`, await Class.find({ schoolId: req.schoolId, academicYear }).select('className classNumeric'));
    throw new ValidationError(`Class "${className}" not found for academic year ${academicYear}. Please create the class first.`);
  }
  
  console.log(`✅ Found class: ${classDoc.className} (${classDoc._id})`);
  
  // Check if student email exists - MULTI-TENANT
  if (studentEmail) {
    const existingStudent = await Student.findOne({ 
      email: studentEmail.toLowerCase().trim(),
      schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
    }).lean();
    if (existingStudent) {
      throw new ValidationError(`Student email ${studentEmail} is already registered`);
    }
  }



  
  // Check if aadhar number exists - MULTI-TENANT
  if (aadharNumber) {
    const existingAadhar = await Student.findOne({ 
      aadharNumber:aadharNumber?.trim(),
      schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
    }).lean();
    if (existingAadhar) {
      throw new ValidationError(`Aadhar number ${aadharNumber} is already registered`);
    }
  }

    if (enrollmentNumber) {
    const exists = await Student.findOne({ enrollmentNumber, schoolId: req.schoolId });
    if (exists) throw new ValidationError("Enrollment number already exists");
  }

  if (scholarNumber) {
    const exists = await Student.findOne({ scholarNumber, schoolId: req.schoolId });
    if (exists) throw new ValidationError("Scholar number already exists");
  }
  
  // Check if parent exists - MULTI-TENANT
  let parent = await Parent.findOne({ 
    email: parentEmail.toLowerCase().trim(),
    schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
  });
  
  let isExistingParent = false;
  let parentID;
  
  if (parent) {
    logger.debug("Found existing parent", { parentID: parent.parentID });
    isExistingParent = true;
    parentID = parent.parentID;
    // ⚠️ RELAXED CHECK: If email matches, we link to existing parent.
    // We ignore name mismatches (e.g. "John Doe" vs "Mr. John Doe") to prevent duplicate errors.
  } else {
    // Generate unique parent ID - MULTI-TENANT
    const year = new Date().getFullYear().toString().slice(-2);
    
    // Find the highest parent ID for THIS SCHOOL
    const lastParent = await Parent.findOne({ 
      schoolId: req.schoolId 
    }).sort({ parentID: -1 }).lean();
    let nextNumber = 1;
    
    if (lastParent && lastParent.parentID) {
      const lastNumber = parseInt(lastParent.parentID.slice(-4));
      nextNumber = lastNumber + 1;
    }
    
    parentID = `PAR${year}${nextNumber.toString().padStart(4, '0')}`;
    
    // Double check this parentID doesn't exist in THIS SCHOOL
    const existingParentID = await Parent.findOne({ 
      parentID, 
      schoolId: req.schoolId 
    }).lean();
    if (existingParentID) {
      // If exists, find next available
      let counter = nextNumber + 1;
      while (counter < 10000) {
        const testID = `PAR${year}${counter.toString().padStart(4, '0')}`;
        const exists = await Parent.findOne({ 
          parentID: testID,
          schoolId: req.schoolId 
        }).lean();
        if (!exists) {
          parentID = testID;
          break;
        }
        counter++;
      }
    }
    
    logger.debug("Creating new parent with ID", { parentID });
  }
  
  // Generate unique student ID - MULTI-TENANT
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Find the highest student ID for THIS SCHOOL
  const lastStudent = await Student.findOne({ 
    schoolId: req.schoolId 
  }).sort({ studentID: -1 }).lean();
  let nextStudentNumber = 1;
  
  if (lastStudent && lastStudent.studentID) {
    const lastNumber = parseInt(lastStudent.studentID.slice(-4));
    nextStudentNumber = lastNumber + 1;
  }
  
  let studentID = `STU${year}${nextStudentNumber.toString().padStart(4, '0')}`;
  
  // Double check this studentID doesn't exist in THIS SCHOOL
  const existingStudentID = await Student.findOne({ 
    studentID,
    schoolId: req.schoolId 
  }).lean();
  if (existingStudentID) {
    // If exists, find next available
    let counter = nextStudentNumber + 1;
    while (counter < 10000) {
      const testID = `STU${year}${counter.toString().padStart(4, '0')}`;
      const exists = await Student.findOne({ 
        studentID: testID,
        schoolId: req.schoolId 
      }).lean();
      if (!exists) {
        studentID = testID;
        break;
      }
      counter++;
    }
  }
  
  // Generate passwords
  const studentPassword = generateSecurePassword();
  const parentPassword = generateSecurePassword();
  
  const studentHashedPassword = await bcrypt.hash(studentPassword, 10);
  const parentHashedPassword = await bcrypt.hash(parentPassword, 10);

  // ✅ Fix date parsing
let formattedDOB;

if (dateOfBirth) {
  const parsedDate = new Date(dateOfBirth);

  if (!isNaN(parsedDate.getTime())) {
    formattedDOB = parsedDate;
  }
}


  
  // ✅ CREATE STUDENT WITH PROPER CLASS ASSIGNMENT - MULTI-TENANT
  const student = new Student({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    name: studentName,
 email: studentEmail ? studentEmail.toLowerCase().trim() : undefined,
    mobileNumber: mobileNumber || undefined,
    password: studentHashedPassword,
    studentID,
    dateOfBirth: formattedDOB,
    gender,
    bloodGroup,
    religion,
    caste,
    nationality: nationality || 'Indian',
    aadharNumber: aadharNumber || undefined,
    
    address: {
      street,
      city,
      state,
      pincode,
      country: country || 'India'
    },
    
    fatherName,
    fatherPhone,
    fatherEmail,
    fatherOccupation,

    motherName,
    motherPhone,
    motherEmail,
    motherOccupation,

    guardianName,
    guardianPhone,
    guardianRelation,
    
    registrationYear: academicYear,
    targetGrade: classDoc.className,
    previousSchool,
    status: section ? 'ACTIVE' : 'ADMITTED',
    
    medicalHistory,
    allergies: allergies ? allergies.split(',').map(a => a.trim()) : [],
    emergencyContact: {
      name: emergencyContactName,
      phone: emergencyContactPhone,
      relation: emergencyContactRelation
    },
    
   transportRequired: toBoolean(transportRequired),
    busRoute,
    pickupPoint,
    hostelResident: toBoolean(hostelResident),
  
    hostelBlock,
    roomNumber,
    
    role: 'student',
    isActive: true,
    admissionDate: new Date().toISOString(),

    enrollmentNumber: enrollmentNumber || undefined,
  scholarNumber: scholarNumber || undefined,


  isHandicapped: toBoolean(isHandicapped),
  

  scholarship: (bankName && accountNumber && ifscCode) ? {
    bankName,
    accountNumber,
    ifscCode,
    accountHolderName,
    scholarshipName,
    ssid
  } : undefined,
  });
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    await student.save({ session });
    logger.info(`Student created: ${studentID} -> ${classDoc.className}`);
    
    // Create or update parent - MULTI-TENANT
    if (isExistingParent) {
      parent.children.push(student._id);
      await parent.save({ session });
      logger.debug("Added child to existing parent");
    } else {
      parent = new Parent({
        schoolId: req.schoolId,  // ✅ MULTI-TENANT
        name: parentName,
        email: parentEmail.toLowerCase().trim(),
        password: parentHashedPassword,
        parentID,
        phone: parentPhone,
        relation: parentRelation,
        occupation: parentOccupation,
        qualification: parentQualification,
        income: parentIncome,
        address: {
          street,
          city,
          state,
          pincode,
          country: country || 'India'
        },
        children: [student._id],
        role: 'parent',
        isActive: true
      });
      
      await parent.save({ session });
      logger.info(`New parent created: ${parentID}`);
    }

    if (section) {
      let nextRollNumber = rollNumber;
      if (!nextRollNumber) {
        const lastEnrollment = await Enrollment.findOne({ schoolId: req.schoolId, class: classDoc._id, section, academicYear }).sort({ rollNumber: -1 }).lean();
        nextRollNumber = lastEnrollment && lastEnrollment.rollNumber ? lastEnrollment.rollNumber + 1 : 1;
      }
      const enrollment = new Enrollment({
        schoolId: req.schoolId,
        student: student._id,
        class: classDoc._id,
        className: classDoc.className,
        section,
        academicYear,
        rollNumber: nextRollNumber,
        status: 'ACTIVE'
      });
      await enrollment.save({ session });
    }
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    logger.error("Transaction aborted. Student/Parent creation failed", { error: error.message });
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern).find(k => k !== 'schoolId') || Object.keys(error.keyPattern)[0];
      if (error.keyValue && error.keyValue[field] === null) {
         throw new ValidationError("A record with this empty/null field already exists. Please provide a unique value.");
      }
      throw new ValidationError(`${field} '${error.keyValue ? error.keyValue[field] : ''}' already exists in this school.`);
    }
    throw new ValidationError(error.message || "Failed to complete registration");
  } finally {
    session.endSession();
  }
  
  // Response
  const studentResponse = {
    ...student.toObject(),
    credentials: {
      studentID,
      password: studentPassword
    }
  };
  delete studentResponse.password;
  
  const parentResponse = {
    ...parent.toObject(),
    credentials: {
      parentID: parent.parentID,
      password: isExistingParent ? null : parentPassword
    }
  };
  delete parentResponse.password;
  
  return successResponse(res, isExistingParent ? 
    'Student registered and linked to existing parent account' : 
    'Student and parent accounts created successfully', 
    {
      student: studentResponse,
      parent: parentResponse,
      isExistingParent
    }, 
    201
  );
});

// Simple create (backward compatibility) - MULTI-TENANT
export const createStudent = asyncHandler(async (req, res) => {
  const {
    name, email, password, dateOfBirth, gender, bloodGroup,
    fatherName, fatherPhone, fatherEmail,
    motherName, motherPhone, motherEmail,
    address, className, section, academicYear, rollNumber, admissionDate,

     // ✅ NEW
  enrollmentNumber,
  scholarNumber,
  
  isHandicapped
  } = req.body;

  
  

  // ✅ Handle profile picture
let profilePicture = '';
let profilePicturePublicId = '';
if (req.file) {
  profilePicture = req.file.path;
  profilePicturePublicId = req.file.filename;
}

  if (!name || !fatherName || !className || !academicYear) {
    throw new ValidationError('Name, father name, class, and academic year are required');
  }
  
  // ✅ FIND CLASS - MULTI-TENANT
  const classDoc = await findClassByName(className, academicYear, req.schoolId);
  
  if (!classDoc) {
    throw new ValidationError(`Class "${className}" not found for academic year ${academicYear}`);
  }
  
  if (email) {
    const existingStudent = await Student.findOne({ 
      email,
      schoolId: req.schoolId 
    }).lean();
    if (existingStudent) {
      throw new ValidationError('Email already exists');
    }
  }

  // ✅ ENROLLMENT UNIQUE CHECK
  if (enrollmentNumber) {
    const exists = await Student.findOne({
      enrollmentNumber,
      schoolId: req.schoolId
    });
    if (exists) {
      throw new ValidationError('Enrollment number already exists');
    }
  }
  

    // ✅ SCHOLAR UNIQUE CHECK
  if (scholarNumber) {
    const exists = await Student.findOne({
      scholarNumber,
      schoolId: req.schoolId
    });
    if (exists) {
      throw new ValidationError('Scholar number already exists');
    }
  }

  const year = new Date().getFullYear().toString().slice(-2);
  const count = await Student.countDocuments({ schoolId: req.schoolId });
  const studentID = `STU${year}${(count + 1).toString().padStart(4, '0')}`;
  
  const plainPassword = password || generateSecurePassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  

  let formattedDOB;
if (dateOfBirth) {
  const parsed = new Date(dateOfBirth);
  if (!isNaN(parsed.getTime())) {
    formattedDOB = parsed;
  }
}

  const student = new Student({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    name,
    profilePicture,
    profilePicturePublicId,
    email: email || undefined, // ✅ Fix: Empty email becomes undefined
    password: hashedPassword,
    studentID,
    dateOfBirth: formattedDOB,
    gender,
    bloodGroup,
    fatherName,
    fatherPhone,
    fatherEmail,
    motherName,
    motherPhone,
    motherEmail,
    address,
    registrationYear: academicYear,
    targetGrade: classDoc.className,
    admissionDate: admissionDate || new Date(),
    status: section ? 'ACTIVE' : 'ADMITTED',

     enrollmentNumber: enrollmentNumber || undefined,
    scholarNumber: scholarNumber || undefined,

     isHandicapped: toBoolean(isHandicapped),

    role: 'student',
    isActive: true,

    
  });
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    await student.save({ session });
    
    if (section) {
      let nextRollNumber = rollNumber;
      if (!nextRollNumber) {
        const lastEnrollment = await Enrollment.findOne({ schoolId: req.schoolId, class: classDoc._id, section, academicYear }).sort({ rollNumber: -1 }).lean();
        nextRollNumber = lastEnrollment && lastEnrollment.rollNumber ? lastEnrollment.rollNumber + 1 : 1;
      }
      const enrollment = new Enrollment({
        schoolId: req.schoolId,
        student: student._id,
        class: classDoc._id,
        className: classDoc.className,
        section,
        academicYear,
        rollNumber: nextRollNumber,
        status: 'ACTIVE'
      });
      await enrollment.save({ session });

      const sectionData = classDoc.sections.find(s => s.sectionName === section);
      if (sectionData) {
        sectionData.currentStrength += 1;
        await classDoc.save({ session });
      }
    }
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
  
  const studentResponse = student.toObject();
  delete studentResponse.password;
  studentResponse.credentials = {
    studentID,
    password: plainPassword
  };
  
  return successResponse(res, 'Student created successfully', studentResponse, 201);
});

// Update student - MULTI-TENANT
// export const updateStudent = asyncHandler(async (req, res) => {
//   const { studentId } = req.params;
//   const updateData = req.body;
  
//   delete updateData.password;
//   delete updateData.studentID;
//   delete updateData.role;
//   delete updateData.schoolId;  // Prevent school change
  
//  // ✅ Handle profile picture upload
//   if (req.file) {
//     const existingStudent = await Student.findOne({ _id: studentId, schoolId: req.schoolId });
//     if (existingStudent && existingStudent.profilePicturePublicId) {
//       await deleteFromCloudinary(existingStudent.profilePicturePublicId);
//     }
//     updateData.profilePicture = req.file.path;
//     updateData.profilePicturePublicId = req.file.filename;
//   }

//   const student = await Student.findOneAndUpdate(
//     { 
//       _id: studentId,
//       schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
//     },
//     updateData,
//     { new: true, runValidators: true }
//   ).select('-password').lean();
  
//   if (!student) {
//     throw new NotFoundError('Student');
//   }
  
//   return successResponse(res, 'Student updated successfully', student);
// });

// export const updateStudent = asyncHandler(async (req, res) => {
//   const { studentId } = req.params;
//   const body = req.body;

//   const updateData = {
//     name: body.name,
//   mobileNumber: body.mobileNumber || body.phone,
//     email: body.email,
//     dateOfBirth: body.dateOfBirth,
//     gender: body.gender,
//     bloodGroup: body.bloodGroup,
//     nationality: body.nationality,
//     status: body.status,
//     medicalHistory: body.medicalHistory,
//     allergies: body.allergies,
//     emergencyContact: {
//       name: body.emergencyContactName,
//       phone: body.emergencyContactPhone,
//       relation: body.emergencyContactRelation,
//     },
//     transportRequired: body.transportRequired === true || body.transportRequired === "true",
//     busRoute: body.busRoute,
//     pickupPoint: body.pickupPoint,
//     parent: body.parent,
//      address: {
//       street: body.street,
//       city: body.city,
//       state: body.state,
//       pincode: body.pincode,
//       country: body.country || "India",
//     },
//     isHandicapped: body.isHandicapped === true || body.isHandicapped === "true",
//     // either keep as string OR keep as object, but not both
//   };

//   Object.keys(updateData).forEach((k) => updateData[k] === undefined && delete updateData[k]);

//   if (req.file) {
//     const existingStudent = await Student.findOne({ _id: studentId, schoolId: req.schoolId });
//     if (existingStudent?.profilePicturePublicId) {
//       await deleteFromCloudinary(existingStudent.profilePicturePublicId);
//     }
//     updateData.profilePicture = req.file.path;
//     updateData.profilePicturePublicId = req.file.filename;
//   }

//   const student = await Student.findOneAndUpdate(
//     { _id: studentId, schoolId: req.schoolId },
//     { $set: updateData },
//     { new: true, runValidators: true }
//   ).select("-password").lean();

//   if (!student) throw new NotFoundError("Student");
//   return successResponse(res, "Student updated successfully", student);
// });

export const updateStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const body = req.body;

  const existingStudent = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId,
  })
    .populate("parent", "name _id")
    .lean();

  if (!existingStudent) throw new NotFoundError("Student");

  if (body.email) {
    const duplicateEmail = await Student.findOne({
      schoolId: req.schoolId,
      email: body.email.toLowerCase().trim(),
      _id: { $ne: studentId },
    }).lean();

    if (duplicateEmail) {
      throw new ValidationError(`Email ${body.email} is already registered`);
    }
  }

  let parentValue = body.parent;

  if (Array.isArray(parentValue)) {
    parentValue =
      parentValue.find((v) => /^[0-9a-fA-F]{24}$/.test(v)) || undefined;
  }

  if (
    parentValue &&
    parentValue !== "[object Object]" &&
    !/^[0-9a-fA-F]{24}$/.test(parentValue)
  ) {
    throw new ValidationError("Invalid parent ID");
  }

  const updateData = {
    name: body.name,
    mobileNumber: body.mobileNumber || body.phone,
    email: body.email ? body.email.toLowerCase().trim() : undefined,
    dateOfBirth: body.dateOfBirth || undefined,
    gender: body.gender,
    bloodGroup: body.bloodGroup,
    nationality: body.nationality,
    status: body.status,
    medicalHistory: body.medicalHistory,
    allergies: body.allergies
      ? body.allergies.split(",").map((a) => a.trim()).filter(Boolean)
      : undefined,
    emergencyContact: {
      name: body.emergencyContactName,
      phone: body.emergencyContactPhone,
      relation: body.emergencyContactRelation,
    },
    transportRequired:
      body.transportRequired === true || body.transportRequired === "true",
    busRoute: body.busRoute,
    pickupPoint: body.pickupPoint,
    parent: parentValue,
    address: {
      street: body.street,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      country: body.country || "India",
    },
    isHandicapped: body.isHandicapped === true || body.isHandicapped === "true",
  };

  Object.keys(updateData).forEach(
    (k) => updateData[k] === undefined && delete updateData[k]
  );

  if (req.file) {
    if (existingStudent.profilePicturePublicId) {
      await deleteFromCloudinary(existingStudent.profilePicturePublicId);
    }
    updateData.profilePicture = req.file.path;
    updateData.profilePicturePublicId = req.file.filename;
  }

  const student = await Student.findOneAndUpdate(
    { _id: studentId, schoolId: req.schoolId },
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .select("-password")
    .lean();

  if (!student) throw new NotFoundError("Student");

  return successResponse(res, "Student updated successfully", student);
});

// Delete student - MULTI-TENANT
export const deleteStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  
  const student = await Student.findOne({ 
    _id: studentId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  // Delete profile picture from Cloudinary on user deletion
  if (student.profilePicturePublicId) {
    await deleteFromCloudinary(student.profilePicturePublicId);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const classData = await Class.findOne({ 
      _id: student.class,
      schoolId: req.schoolId 
    });
    if (classData) {
      const sectionData = classData.sections.find(s => s.sectionName === student.section);
      if (sectionData && sectionData.currentStrength > 0) {
        sectionData.currentStrength -= 1;
        await classData.save({ session });
      }
    }
    
    await Parent.updateMany(
      { 
        schoolId: req.schoolId,
        children: studentId 
      },
      { $pull: { children: studentId } },
      { session }
    );

    await Enrollment.updateMany(
      { student: studentId, schoolId: req.schoolId },
      { status: 'DROPPED' },
      { session }
    );
    
    student.isDeleted = true;
    student.deletedAt = new Date();
    await student.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
  
  return successResponse(res, 'Student deleted successfully');
});

// Bulk upload students - MULTI-TENANT
export const bulkUploadStudent = asyncHandler(async (req, res) => {
  const { students } = req.body;
  
  if (!students || !Array.isArray(students) || students.length === 0) {
    throw new ValidationError('Students array is required');
  }
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const studentData of students) {
    try {
      const year = new Date().getFullYear().toString().slice(-2);
     const lastStudent = await Student.findOne({ schoolId: req.schoolId }).sort({ studentID: -1 });

let next = 1;
if (lastStudent && lastStudent.studentID) {
  next = parseInt(lastStudent.studentID.slice(-4)) + 1;
}

const studentID = `STU${year}${next.toString().padStart(4, '0')}`;
    
      
      const tempPassword = generateSecurePassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      const student = new Student({
        schoolId: req.schoolId,  // ✅ MULTI-TENANT
        ...studentData,
        studentID,
        password: hashedPassword,
        role: 'student',
        isActive: true
      });
      
      await student.save();
      results.success.push(studentID);
    } catch (error) {
      results.failed.push({
        student: studentData.name,
        error: error.message
      });
    }
  }
  
  return successResponse(res, 'Bulk upload completed', results, 201);
});

// Update student status - MULTI-TENANT
export const updateStudentStatus = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { status } = req.body;
  
  if (!['APPLICANT', 'ADMITTED', 'ACTIVE', 'ALUMNI', 'WITHDRAWN'].includes(status)) {
    throw new ValidationError('Invalid status. Expected APPLICANT, ADMITTED, ACTIVE, ALUMNI, or WITHDRAWN.');
  }
  
  const student = await Student.findOneAndUpdate(
    { 
      _id: studentId,
      schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
    },
    { status },
    { new: true }
  ).select('-password').lean();
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  return successResponse(res, 'Student status updated successfully', student);
});

// Promote students - MULTI-TENANT
export const promoteStudents = asyncHandler(async (req, res) => {
  const { studentIds, targetClassId, targetSection, targetAcademicYear } = req.body;
  
  if (!studentIds || !targetClassId || !targetSection || !targetAcademicYear) {
    throw new ValidationError('Student IDs, target class, section, and academic year are required');
  }
  
  const targetClass = await Class.findOne({ 
    _id: targetClassId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
  });
  if (!targetClass) {
    throw new NotFoundError('Target class');
  }
  
  await Student.updateMany(
    { 
      _id: { $in: studentIds },
      schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
    },
    { status: 'ACTIVE' }
  );

  await Enrollment.updateMany(
    { student: { $in: studentIds }, schoolId: req.schoolId, status: 'ACTIVE' },
    { status: 'PROMOTED' }
  );

  const lastEnrollment = await Enrollment.findOne({
    schoolId: req.schoolId, class: targetClassId, section: targetSection, academicYear: targetAcademicYear
  }).sort({ rollNumber: -1 }).lean();
  
  let nextRollNumber = lastEnrollment && lastEnrollment.rollNumber ? lastEnrollment.rollNumber + 1 : 1;

  const enrollmentDocs = studentIds.map(studentId => {
    const doc = {
      schoolId: req.schoolId,
      student: studentId,
      class: targetClassId,
      className: targetClass.className,
      section: targetSection,
      academicYear: targetAcademicYear,
      rollNumber: nextRollNumber++,
      status: 'ACTIVE'
    }
    return doc;
  });
  
  await Enrollment.insertMany(enrollmentDocs);
  
  return successResponse(res, `Successfully promoted ${studentIds.length} students`, {
    promoted: studentIds.length
  });
});


export const changeStudentPassword = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    throw new ValidationError("Password must be at least 6 characters");
  }

  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId,
  });

  if (!student) {
    throw new NotFoundError("Student");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  student.password = hashedPassword;
  await student.save();

  return successResponse(res, "Password updated successfully");
});

export default {
  getAllStudents,
  getStudentById,
  createStudent,
  createStudentWithParent,
  updateStudent,
  deleteStudent,
  bulkUploadStudent,
  updateStudentStatus,
  promoteStudents
};
