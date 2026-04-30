import mongoose from 'mongoose';
import Enquiry from '../../models/Enquiry.js';
import EnquiryFollowUp from '../../models/EnquiryFollowUp.js';
import Student from '../../models/Student.js';
import Parent from '../../models/Parent.js';
import Class from '../../models/Class.js';
import InventoryItem from '../../models/InventoryItem.js';
import Expense from '../../models/Expense.js';
import ExpenseCategory from '../../models/ExpenseCategory.js';
import bcrypt from 'bcryptjs';
import Session from '../../models/Session.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// ==============================================
// 1. STAGE 1: CAPTURE (Create Enquiry)
// ==============================================

export const createEnquiry = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  let { purchasedProspectus, targetClass, academicYear, ...otherData } = req.body;

  // 1. Resolve Academic Year automatically if missing
  if (!academicYear) {
    const activeSession = await Session.findOne({ isActive: true });
    if (activeSession) {
      academicYear = `${activeSession.startYear}-${activeSession.endYear}`;
    } else {
      throw new ValidationError("Academic year is required and no active session was found.");
    }
  }

  // 2. Resolve targetClass string (e.g. "Nursery") to its corresponding ObjectId
  if (targetClass && !mongoose.Types.ObjectId.isValid(targetClass)) {
    // Strategy 1: Exact match
    let classDoc = await Class.findOne({ 
      className: new RegExp(`^${targetClass}$`, 'i'),
      schoolId: schoolId,
      academicYear: academicYear
    });
    
    // Strategy 2: Try with "Class " prefix (e.g., "11" -> "Class 11")
    if (!classDoc && !targetClass.toString().toLowerCase().startsWith('class ')) {
      classDoc = await Class.findOne({ 
        className: new RegExp(`^Class ${targetClass}$`, 'i'), 
        schoolId: schoolId,
        academicYear: academicYear
      });
    }

    // Strategy 3: Try numeric match (e.g., "11" -> classNumeric: 11)
    if (!classDoc) {
      const numericMatch = targetClass.toString().match(/\d+/);
      if (numericMatch) {
        classDoc = await Class.findOne({
          classNumeric: parseInt(numericMatch[0]),
          schoolId: schoolId,
          academicYear: academicYear
        });
      }
    }

    if (!classDoc) {
      throw new ValidationError(`Class '${targetClass}' not found in this school.`);
    }
    
    targetClass = classDoc._id;
  }

  const enquiryData = {
    ...otherData,
    targetClass,
    academicYear,
    schoolId,
    status: req.body.status || 'NEW',
    assignedTo: req.user.id // Assign to the admin/counselor creating it
  };

  const enquiry = await Enquiry.create(enquiryData);

  // INVENTORY INTEGRATION: If a prospectus was purchased, deduct it from inventory
  if (purchasedProspectus) {
    const prospectusItem = await InventoryItem.findOne({ 
      schoolId, 
      itemName: { $regex: /Prospectus/i } 
    });

    if (prospectusItem && prospectusItem.inStorage > 0) {
      prospectusItem.inStorage -= 1;
      await prospectusItem.save();
    }
  }

  // (Future feature: Trigger automated WhatsApp/SMS API here using enquiry.primaryPhone)

  return successResponse(res, 'Enquiry captured successfully', enquiry, 201);
});

// ==============================================
// 2. STAGE 2 & 3: QUALIFICATION & FOLLOW-UP LOOP
// ==============================================

export const addFollowUp = asyncHandler(async (req, res) => {
  const { enquiryId } = req.params;
  const { outcome, conversationNotes, nextActionDate } = req.body;
  const schoolId = req.schoolId;

  const enquiry = await Enquiry.findOne({ _id: enquiryId, schoolId });
  if (!enquiry) throw new NotFoundError('Enquiry');

  // 1. Create the Follow-up Log
  const followUp = await EnquiryFollowUp.create({
    schoolId,
    enquiry: enquiry._id,
    followedBy: req.user.id,
    outcome,
    conversationNotes,
    nextActionDate
  });

  // 2. Automate the Master Enquiry Status updates (The Push Logic)
  enquiry.latestFollowUpDate = new Date();
  if (nextActionDate) enquiry.nextActionDate = new Date(nextActionDate);

  if (['BUSY', 'CALL_LATER'].includes(outcome)) {
    enquiry.status = 'PENDING';
  } else if (outcome === 'VISIT_SCHEDULED') {
    enquiry.status = 'FOLLOWED_UP';
    enquiry.priority = 'HOT';
  } else if (outcome === 'NOT_INTERESTED') {
    enquiry.status = 'CLOSED_LOST';
    enquiry.closeReason = 'Not Interested (From Follow-up)';
  } else {
    enquiry.status = 'FOLLOWED_UP';
  }

  await enquiry.save();

  return successResponse(res, 'Follow-up logged successfully', { enquiry, followUp }, 201);
});

// ==============================================
// 3. STAGE 4: THE VISIT & MANUAL STATUS UPDATE
// ==============================================

export const updateEnquiryStatus = asyncHandler(async (req, res) => {
  const { enquiryId } = req.params;
  const { status, priority, closeReason } = req.body;

  const enquiry = await Enquiry.findOne({ _id: enquiryId, schoolId: req.schoolId });
  if (!enquiry) throw new NotFoundError('Enquiry');

  if (status) {
    enquiry.status = status;
    // Auto-upgrade priority if they visit
    if (status === 'VISITED') enquiry.priority = 'HOT';
  }

  if (priority) enquiry.priority = priority;
  
  if (status === 'CLOSED_LOST') {
    enquiry.closeReason = closeReason || 'Closed by Admin';
  }

  await enquiry.save();
  return successResponse(res, 'Enquiry updated successfully', enquiry);
});

// ==============================================
// 4. STAGE 5: CLOSURE & CONVERSION TO STUDENT
// ==============================================

export const convertEnquiryToStudent = asyncHandler(async (req, res) => {
  const { enquiryId } = req.params;
  const { classId, academicYear } = req.body || {}; 
  const schoolId = req.schoolId;

  const enquiry = await Enquiry.findOne({ _id: enquiryId, schoolId }).populate('targetClass');
  if (!enquiry) throw new NotFoundError('Enquiry');
  if (enquiry.status === 'ADMITTED') throw new ValidationError('Enquiry is already admitted/converted');

  // Validate Target Class
  const resolvedClassId = classId || enquiry.targetClass?._id;
  if (!resolvedClassId) throw new ValidationError('A target class is required to admit a student.');

  const targetClass = await Class.findOne({ _id: resolvedClassId, schoolId });
  if (!targetClass) throw new NotFoundError('Target Class');
  
  const resolvedAcademicYear = academicYear || targetClass.academicYear;

  // --- ID GENERATION LOGIC ---
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Parent ID
  const lastParent = await Parent.findOne({ schoolId }).sort({ parentID: -1 });
  const nextParentNum = (lastParent && lastParent.parentID) ? parseInt(lastParent.parentID.slice(-4)) + 1 : 1;
  const parentID = `PAR${year}${nextParentNum.toString().padStart(4, '0')}`;
  
  // Student ID
  const lastStudent = await Student.findOne({ schoolId }).sort({ studentID: -1 });
  const nextStudentNum = (lastStudent && lastStudent.studentID) ? parseInt(lastStudent.studentID.slice(-4)) + 1 : 1;
  const studentID = `STU${year}${nextStudentNum.toString().padStart(4, '0')}`;

  const defaultPassword = await bcrypt.hash('Welcome@123', 10);

  // 1. Create Parent
  const parentEmail = enquiry.email || `p_${parentID}@school.com`; // Fallback if parent didn't provide email
  const newParent = await Parent.create({
    schoolId,
    name: enquiry.parentName,
    email: parentEmail.toLowerCase(),
    password: defaultPassword,
    parentID,
    phone: enquiry.primaryPhone,
    relation: 'Father', // Safe default fallback
    occupation: enquiry.occupation,
    address: { street: enquiry.address },
    role: 'parent',
    isActive: true,
    children: []
  });

  // 2. Create Student
  const newStudent = await Student.create({
    schoolId,
    name: enquiry.studentName,
    studentID,
    password: defaultPassword,
    // Very rough estimate of DOB based on age if provided
    dateOfBirth: enquiry.age ? new Date(new Date().setFullYear(new Date().getFullYear() - enquiry.age)) : undefined, 
    gender: enquiry.gender || 'Male',
    fatherName: enquiry.parentName,
    fatherPhone: enquiry.primaryPhone,
    address: { street: enquiry.address },
    class: targetClass._id,
    className: targetClass.className,
    academicYear: resolvedAcademicYear,
    parent: newParent._id,
    status: 'ENROLLED',
    role: 'student',
    isActive: true,
    admissionDate: new Date()
  });

  // Link Child to Parent
  newParent.children.push(newStudent._id);
  await newParent.save();

  // 3. Mark Enquiry as Admitted
  enquiry.status = 'ADMITTED';
  await enquiry.save();

  return successResponse(res, 'Enquiry successfully converted to Student', {
    student: newStudent,
    parent: newParent,
    credentials: { studentID, parentID, password: 'Welcome@123' }
  }, 201);
});

// ==============================================
// 4B. STAGE 5: CLOSURE (Mark as Lost/Closed)
// ==============================================

export const closeEnquiry = asyncHandler(async (req, res) => {
  const { enquiryId } = req.params;
  const { closeReason } = req.body;
  const schoolId = req.schoolId;

  const enquiry = await Enquiry.findOne({ _id: enquiryId, schoolId });
  if (!enquiry) throw new NotFoundError('Enquiry');

  if (enquiry.status === 'ADMITTED') {
    throw new ValidationError('Cannot close an already admitted enquiry');
  }

  enquiry.status = 'CLOSED_LOST';
  enquiry.closeReason = closeReason || 'Not Interested';
  await enquiry.save();

  return successResponse(res, 'Enquiry marked as Closed/Lost', enquiry);
});

// ==============================================
// MASS OPERATIONS
// ==============================================

export const massAssignEnquiries = asyncHandler(async (req, res) => {
  const { enquiryIds, assignedTo } = req.body;
  const schoolId = req.schoolId;

  if (!enquiryIds || !Array.isArray(enquiryIds) || enquiryIds.length === 0) {
    throw new ValidationError('Enquiry IDs array is required');
  }
  if (!assignedTo) {
    throw new ValidationError('AssignedTo admin/counselor ID is required');
  }

  // Only assign leads that are active (Not admitted or lost)
  const result = await Enquiry.updateMany(
    { _id: { $in: enquiryIds }, schoolId, status: { $nin: ['ADMITTED', 'CLOSED_LOST'] } },
    { $set: { assignedTo } }
  );

  return successResponse(res, `Successfully assigned ${result.modifiedCount} active leads`, {
    assignedCount: result.modifiedCount
  });
});

// ==============================================
// 5. DASHBOARD & VIEWS
// ==============================================

export const getEnquiries = asyncHandler(async (req, res) => {
  const { status, priority, academicYear } = req.query;
  const filter = { schoolId: req.schoolId };

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (academicYear) filter.academicYear = academicYear;

  const enquiries = await Enquiry.find(filter)
    .populate('targetClass', 'className')
    .populate('assignedTo', 'name')
    .sort({ createdAt: -1 });

  return successResponse(res, 'Enquiries retrieved', enquiries);
});

export const getEnquiryById = asyncHandler(async (req, res) => {
  const { enquiryId } = req.params;
  const schoolId = req.schoolId;

  const enquiry = await Enquiry.findOne({ _id: enquiryId, schoolId })
    .populate('targetClass', 'className')
    .populate('assignedTo', 'name');

  if (!enquiry) throw new NotFoundError('Enquiry');

  const followUps = await EnquiryFollowUp.find({ enquiry: enquiryId, schoolId })
    .populate('followedBy', 'name')
    .sort({ followUpDate: -1 });

  return successResponse(res, 'Enquiry details retrieved', { enquiry, followUps });
});

export const getEnquiryDashboard = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  // 1. Kanban Pipeline Groups
  const pipeline = await Enquiry.aggregate([
    { $match: { schoolId: new mongoose.Types.ObjectId(schoolId), status: { $in: ['NEW', 'PENDING', 'FOLLOWED_UP', 'VISITED'] } } },
    {
      $lookup: {
        from: 'classes', // The collection name for the Class model
        localField: 'targetClass',
        foreignField: '_id',
        as: 'targetClassDetails' // Match frontend expectation
      }
    },
    { $group: { _id: "$status", leads: { $push: "$$ROOT" }, count: { $sum: 1 } } }
  ]);

  // 2. Today's Tasks
  const todaysTasks = await Enquiry.find({
    schoolId,
    status: { $nin: ['ADMITTED', 'CLOSED_LOST'] },
    nextActionDate: { $gte: todayStart, $lte: todayEnd }
  })
  .populate('targetClass', 'className')
  .select('studentName parentName primaryPhone nextActionDate priority status targetClass');

  // 3. Overdue Tasks
  const overdueTasks = await Enquiry.find({
    schoolId,
    status: { $nin: ['ADMITTED', 'CLOSED_LOST'] },
    nextActionDate: { $lt: todayStart }
  })
  .populate('targetClass', 'className')
  .select('studentName parentName primaryPhone nextActionDate priority status targetClass');

  return successResponse(res, 'Dashboard data retrieved', {
    pipeline,
    tasks: { today: todaysTasks, overdue: overdueTasks }
  });
});

export const getEnquiryAnalytics = asyncHandler(async (req, res) => {
  const schoolId = new mongoose.Types.ObjectId(req.schoolId);
  
  const totalLeads = await Enquiry.countDocuments({ schoolId });
  const admitted = await Enquiry.countDocuments({ schoolId, status: 'ADMITTED' });
  const visited = await Enquiry.countDocuments({ schoolId, status: 'VISITED' });
  const followedUp = await Enquiry.countDocuments({ schoolId, status: { $in: ['FOLLOWED_UP', 'VISITED', 'ADMITTED'] } });

  const conversionRate = totalLeads > 0 ? ((admitted / totalLeads) * 100).toFixed(2) : 0;

  // Customer Acquisition Cost (CAC) Calculation
  // Finding Marketing Expenses
  const marketingCategory = await ExpenseCategory.findOne({ schoolId, name: { $regex: /Marketing/i } });
  let totalMarketingExpense = 0;
  
  if (marketingCategory) {
    const expenses = await Expense.aggregate([
      { $match: { schoolId, category: marketingCategory._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    totalMarketingExpense = expenses[0]?.total || 0;
  }

  const cac = admitted > 0 ? (totalMarketingExpense / admitted).toFixed(2) : 0;

  return successResponse(res, 'Analytics retrieved', {
    funnel: { totalLeads, followedUp, visited, admitted },
    conversionRate: `${conversionRate}%`,
    financials: { totalMarketingExpense, customerAcquisitionCost: cac }
  });
});