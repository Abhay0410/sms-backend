import mongoose from 'mongoose';
import Student from '../../models/Student.js';
import Class from '../../models/Class.js';
import Enrollment from '../../models/Enrollment.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// ==============================================
// 1. GET UNASSIGNED ADMITTED STUDENTS (Matchmaker UI - Left Pane)
// ==============================================

export const getUnassignedAdmissions = asyncHandler(async (req, res) => {
  const { academicYear, targetGrade } = req.query;
  const schoolId = req.schoolId;

  if (!academicYear) {
    throw new ValidationError('Academic year is required to filter admissions');
  }

  // 1. Find all ADMITTED students
  const filter = { schoolId, status: 'ADMITTED' };
  if (targetGrade) filter.targetGrade = new RegExp(`^${targetGrade}$`, 'i');

  const admittedStudents = await Student.find(filter).sort({ createdAt: 1 }).lean();

  // 2. Ensure they don't already have an Enrollment record for this specific year
  const studentIds = admittedStudents.map(s => s._id);
  const existingEnrollments = await Enrollment.find({
    schoolId,
    student: { $in: studentIds },
    academicYear
  }).lean();

  const enrolledStudentIds = existingEnrollments.map(e => e.student.toString());
  
  // Filter out any student that mistakenly already has an active enrollment
  const unassignedStudents = admittedStudents.filter(
    s => !enrolledStudentIds.includes(s._id.toString())
  );

  return successResponse(res, 'Unassigned admissions retrieved successfully', {
    count: unassignedStudents.length,
    students: unassignedStudents
  });
});

// ==============================================
// 2. BULK ENROLL STUDENTS (Matchmaker UI - The Action)
// ==============================================

export const bulkEnrollStudents = asyncHandler(async (req, res) => {
  const { studentIds, classId, sectionName, academicYear } = req.body;
  const schoolId = req.schoolId;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ValidationError('An array of student IDs is required');
  }
  if (!classId || !sectionName || !academicYear) {
    throw new ValidationError('Class ID, Section Name, and Academic Year are required');
  }

  // 1. Verify Class and Section Capacity
  const classData = await Class.findOne({ _id: classId, schoolId });
  if (!classData) throw new NotFoundError('Class');

  const section = classData.sections.find(s => s.sectionName === sectionName);
  if (!section) throw new NotFoundError('Section');

  const availableSeats = section.capacity - section.currentStrength;
  if (studentIds.length > availableSeats) {
    throw new ValidationError(`Only ${availableSeats} seats available in ${classData.className} - Section ${sectionName}. You selected ${studentIds.length} students.`);
  }

  // 2. Determine Starting Roll Number
  const lastEnrollment = await Enrollment.findOne({
    schoolId, class: classId, section: sectionName, academicYear
  }).sort({ rollNumber: -1 }).lean();

  let nextRollNumber = lastEnrollment && lastEnrollment.rollNumber ? lastEnrollment.rollNumber + 1 : 1;
  const startingRollNumber = nextRollNumber;

  // 3. Process Bulk Enrollments (Using Transaction for safety)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let enrolledCount = 0;
    
    // Prepare bulk writes for Enrollments
    const enrollmentDocs = [];
    
    for (const studentId of studentIds) {
      const student = await Student.findOne({ _id: studentId, schoolId }).session(session);
      if (!student) continue;

      // Prepare Enrollment Junction record
      enrollmentDocs.push({
        schoolId,
        student: studentId,
        class: classId,
        className: classData.className,
        section: sectionName,
        academicYear,
        rollNumber: nextRollNumber,
        status: 'ACTIVE'
      });

      // Update Student's master CRM status to ACTIVE
      student.status = 'ACTIVE';
      await student.save({ session });

      nextRollNumber++;
      enrolledCount++;
    }

    // Insert all enrollments at once
    if (enrollmentDocs.length > 0) {
      await Enrollment.insertMany(enrollmentDocs, { session });
      
      // Update Class Section Strength
      section.currentStrength += enrolledCount;
      await classData.save({ session });
    }

    await session.commitTransaction();

    return successResponse(res, `Successfully enrolled ${enrolledCount} students into ${classData.className} - Section ${sectionName}`, {
      enrolledCount,
      startingRollNumber,
      endingRollNumber: nextRollNumber - 1
    }, 201);

  } catch (error) {
    await session.abortTransaction();
    
    // Detect Duplicate Enrollments
    if (error.code === 11000) {
      throw new ValidationError("One or more selected students are already enrolled for this academic year.");
    }
    throw error;
  } finally {
    session.endSession();
  }
});

export default {
  getUnassignedAdmissions,
  bulkEnrollStudents
};