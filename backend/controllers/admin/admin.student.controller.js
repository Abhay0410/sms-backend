// controllers/admin/admin.student.controller.js - MULTI-TENANT VERSION
import Student from '../../models/Student.js';
import Parent from '../../models/Parent.js';
import Class from '../../models/Class.js';
import bcrypt from 'bcryptjs';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { getPaginationParams } from '../../utils/pagination.js';

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
export const getAllStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { className, section, academicYear, status, search } = req.query;
  
  const filter = { 
    schoolId: req.schoolId  // ✅ CRITICAL MULTI-TENANT FILTER
  };
  
  if (className) filter.className = className;
  if (section) filter.section = section;
  if (academicYear) filter.academicYear = academicYear;
  if (status) filter.status = status;
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { studentID: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { fatherName: { $regex: search, $options: 'i' } }
    ];
  }
  
  const [students, total] = await Promise.all([
    Student.find(filter)
      .populate('class', 'className')
      .select('-password')
      .sort({ rollNumber: 1 })
      .skip(skip)
      .limit(limit),
    Student.countDocuments(filter)
  ]);
  
  return paginatedResponse(res, 'Students retrieved successfully', students, page, limit, total);
});

// Get student by ID - MULTI-TENANT
export const getStudentById = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  
  const student = await Student.findOne({ 
    _id: studentId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
  })
    .populate('class', 'className sections')
    .select('-password');
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  return successResponse(res, 'Student retrieved successfully', student);
});

// Create student with parent - MULTI-TENANT
export const createStudentWithParent = asyncHandler(async (req, res) => {
  const {
    // Student details
    studentName, studentEmail, dateOfBirth, gender, bloodGroup, religion, caste,
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
    className, academicYear, previousSchool,
    
    // Medical Info
    medicalHistory, allergies, emergencyContactName, emergencyContactPhone, emergencyContactRelation,
    
    // Transport & Hostel
    transportRequired, busRoute, pickupPoint,
    hostelResident, hostelBlock, roomNumber
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
      email: studentEmail,
      schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
    });
    if (existingStudent) {
      throw new ValidationError(`Student email ${studentEmail} is already registered`);
    }
  }
  
  // Check if aadhar number exists - MULTI-TENANT
  if (aadharNumber) {
    const existingAadhar = await Student.findOne({ 
      aadharNumber,
      schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
    });
    if (existingAadhar) {
      throw new ValidationError(`Aadhar number ${aadharNumber} is already registered`);
    }
  }
  
  // Check if parent exists - MULTI-TENANT
  let parent = await Parent.findOne({ 
    email: parentEmail.toLowerCase().trim(),
    schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
  });
  
  let isExistingParent = false;
  let parentID;
  
  if (parent) {
    console.log("✅ Found existing parent:", parent.parentID);
    isExistingParent = true;
    parentID = parent.parentID;
    
    // Check if parent name matches
    if (parent.name.toLowerCase() !== parentName.toLowerCase().trim()) {
      throw new ValidationError(`Email ${parentEmail} is already registered with name: ${parent.name}`);
    }
  } else {
    // Generate unique parent ID - MULTI-TENANT
    const year = new Date().getFullYear().toString().slice(-2);
    
    // Find the highest parent ID for THIS SCHOOL
    const lastParent = await Parent.findOne({ 
      schoolId: req.schoolId 
    }).sort({ parentID: -1 });
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
    });
    if (existingParentID) {
      // If exists, find next available
      let counter = nextNumber + 1;
      while (counter < 10000) {
        const testID = `PAR${year}${counter.toString().padStart(4, '0')}`;
        const exists = await Parent.findOne({ 
          parentID: testID,
          schoolId: req.schoolId 
        });
        if (!exists) {
          parentID = testID;
          break;
        }
        counter++;
      }
    }
    
    console.log("🆕 Creating new parent with ID:", parentID);
  }
  
  // Generate unique student ID - MULTI-TENANT
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Find the highest student ID for THIS SCHOOL
  const lastStudent = await Student.findOne({ 
    schoolId: req.schoolId 
  }).sort({ studentID: -1 });
  let nextStudentNumber = 1;
  
  if (lastStudent && lastStudent.studentID) {
    const lastNumber = parseInt(lastStudent.studentID.slice(-4));
    nextStudentNumber = lastNumber + 1;
  }
  
  const studentID = `STU${year}${nextStudentNumber.toString().padStart(4, '0')}`;
  
  // Double check this studentID doesn't exist in THIS SCHOOL
  const existingStudentID = await Student.findOne({ 
    studentID,
    schoolId: req.schoolId 
  });
  if (existingStudentID) {
    // If exists, find next available
    let counter = nextStudentNumber + 1;
    while (counter < 10000) {
      const testID = `STU${year}${counter.toString().padStart(4, '0')}`;
      const exists = await Student.findOne({ 
        studentID: testID,
        schoolId: req.schoolId 
      });
      if (!exists) {
        studentID = testID;
        break;
      }
      counter++;
    }
  }
  
  // Generate passwords
  const studentPassword = `Student@${studentID.slice(-4)}`;
  const parentPassword = `Parent@${parentID.slice(-4)}`;
  
  const studentHashedPassword = await bcrypt.hash(studentPassword, 10);
  const parentHashedPassword = await bcrypt.hash(parentPassword, 10);
  
  // ✅ CREATE STUDENT WITH PROPER CLASS ASSIGNMENT - MULTI-TENANT
  const student = new Student({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    name: studentName,
    email: studentEmail || undefined,
    password: studentHashedPassword,
    studentID,
    dateOfBirth,
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
    
    // ✅ PROPER CLASS ASSIGNMENT
    class: classDoc._id,
    className: classDoc.className,
    academicYear,
    previousSchool,
    status: 'REGISTERED',
    
    medicalHistory,
    allergies: allergies ? allergies.split(',').map(a => a.trim()) : [],
    emergencyContact: {
      name: emergencyContactName,
      phone: emergencyContactPhone,
      relation: emergencyContactRelation
    },
    
    transportRequired: transportRequired || false,
    busRoute,
    pickupPoint,
    
    hostelResident: hostelResident || false,
    hostelBlock,
    roomNumber,
    
    role: 'student',
    isActive: true,
    admissionDate: new Date()
  });
  
  try {
    await student.save();
    console.log(`✅ Student created: ${studentID} → ${classDoc.className}`);
  } catch (error) {
    console.error("❌ Student creation failed:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      throw new ValidationError(`${field} already exists: ${error.keyValue[field]}`);
    }
    throw error;
  }
  
  // Create or update parent - MULTI-TENANT
  if (isExistingParent) {
    parent.children.push(student._id);
    try {
      await parent.save();
      console.log("✅ Added child to existing parent");
    } catch (error) {
      console.error("❌ Parent update failed:", error);
      await Student.findByIdAndDelete(student._id);
      throw new ValidationError("Failed to update parent account");
    }
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
    
    try {
      await parent.save();
      console.log("✅ New parent created:", parentID);
    } catch (error) {
      console.error("❌ Parent creation failed:", error);
      await Student.findByIdAndDelete(student._id);
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ValidationError(`${field} already exists: ${error.keyValue[field]}`);
      }
      throw error;
    }
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
    address, className, section, academicYear, rollNumber, admissionDate
  } = req.body;

  
  

  // ✅ Handle profile picture
let profilePicture = null;
if (req.file) {
  profilePicture = req.file.filename;  // only filename save
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
    });
    if (existingStudent) {
      throw new ValidationError('Email already exists');
    }
  }
  
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await Student.countDocuments({ schoolId: req.schoolId });
  const studentID = `STU${year}${(count + 1).toString().padStart(4, '0')}`;
  
  const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('Student@0001', 10);
  
  const student = new Student({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    name,
    profilePicture,
    email,
    password: hashedPassword,
    studentID,
    dateOfBirth,
    gender,
    bloodGroup,
    fatherName,
    fatherPhone,
    fatherEmail,
    motherName,
    motherPhone,
    motherEmail,
    address,
    class: classDoc._id,
    className: classDoc.className,
    section,
    academicYear,
    rollNumber: rollNumber || count + 1,
    admissionDate: admissionDate || new Date(),
    status: section ? 'ENROLLED' : 'REGISTERED',
    role: 'student',
    isActive: true
  });
  
  await student.save();
  
  // Update section strength if section provided - MULTI-TENANT
  if (section) {
    const sectionData = classDoc.sections.find(s => s.sectionName === section);
    if (sectionData) {
      sectionData.currentStrength += 1;
      await classDoc.save();
    }
  }
  
  const studentResponse = student.toObject();
  delete studentResponse.password;
  
  return successResponse(res, 'Student created successfully', studentResponse, 201);
});

// Update student - MULTI-TENANT
export const updateStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const updateData = req.body;
  
  delete updateData.password;
  delete updateData.studentID;
  delete updateData.role;
  delete updateData.schoolId;  // Prevent school change
  
 // ✅ Handle profile picture upload
  if (req.file) {
    updateData.profilePicture = req.file.filename;
  }

  const student = await Student.findOneAndUpdate(
    { 
      _id: studentId,
      schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
    },
    updateData,
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  return successResponse(res, 'Student updated successfully', student);
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
  
  const classData = await Class.findOne({ 
    _id: student.class,
    schoolId: req.schoolId 
  });
  if (classData) {
    const sectionData = classData.sections.find(s => s.sectionName === student.section);
    if (sectionData && sectionData.currentStrength > 0) {
      sectionData.currentStrength -= 1;
      await classData.save();
    }
  }
  
  await Parent.updateMany(
    { 
      schoolId: req.schoolId,
      children: studentId 
    },
    { $pull: { children: studentId } }
  );
  
  await student.deleteOne();
  
  return successResponse(res, 'Student deleted successfully');
});

// Bulk upload students - MULTI-TENANT
export const bulkUploadStudents = asyncHandler(async (req, res) => {
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
      const count = await Student.countDocuments({ schoolId: req.schoolId });
      const studentID = `STU${year}${(count + 1).toString().padStart(4, '0')}`;
      
      const hashedPassword = await bcrypt.hash('Student@0001', 10);
      
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
  
  if (!['REGISTERED', 'ENROLLED', 'SUSPENDED', 'WITHDRAWN', 'GRADUATED', 'TRANSFERRED'].includes(status)) {
    throw new ValidationError('Invalid status');
  }
  
  const student = await Student.findOneAndUpdate(
    { 
      _id: studentId,
      schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
    },
    { status },
    { new: true }
  ).select('-password');
  
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
  
  const updatedStudents = await Student.updateMany(
    { 
      _id: { $in: studentIds },
      schoolId: req.schoolId  // ✅ MULTI-TENANT FILTER
    },
    {
      class: targetClassId,
      className: targetClass.className,
      section: targetSection,
      academicYear: targetAcademicYear,
      status: 'ENROLLED'
    }
  );
  
  return successResponse(res, `Successfully promoted ${updatedStudents.modifiedCount} students`, {
    promoted: updatedStudents.modifiedCount
  });
});

export default {
  getAllStudents,
  getStudentById,
  createStudent,
  createStudentWithParent,
  updateStudent,
  deleteStudent,
  bulkUploadStudents,
  updateStudentStatus,
  promoteStudents
};
