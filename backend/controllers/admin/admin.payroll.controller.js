// controllers/admin/admin.payroll.controller.js
// import Payroll from '../../models/Payroll.js';
import Teacher from '../../models/Teacher.js';
import LeaveRequest from '../../models/LeaveRequest.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import Payroll from '../../models/Payroll.js';
// import Teacher from '../../models/Teacher.js';
// import LeaveRequest from '../../models/LeaveRequest.js';
// import { asyncHandler } from '../../middleware/errorHandler.js';
// import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { successResponse } from '../../utils/response.js';
// import { successResponse } from '../../utils/response.js';

// export const generateMonthlyPayroll = asyncHandler(async (req, res) => {
//   const { month, year } = req.body;
//   const schoolId = req.schoolId;

//   const teachers = await Teacher.find({ schoolId, status: 'ACTIVE' });

//   const payrollPromises = teachers.map(async (teacher) => {
//     // 1. Calculate Unpaid Leaves
//     const unpaidLeaves = await LeaveRequest.countDocuments({
//       teacherId: teacher._id,
//       status: 'APPROVED',
//       leaveType: 'UNPAID',
//       startDate: { $gte: new Date(year, month - 1, 1) },
//       endDate: { $lte: new Date(year, month, 0) }
//     });

//     // 2. Simple Salary Formula
//     const daysInMonth = new Date(year, month, 0).getDate();
//     const dailyRate = (teacher.salary?.basic || 0) / daysInMonth;
//     const leaveDeduction = unpaidLeaves * dailyRate;
    
//     // 3. Pension (Example: 10% of basic)
//     const pension = (teacher.salary?.basic || 0) * 0.10;

//     const netSalary = (teacher.salary?.total || 0) - leaveDeduction - pension;

//     return {
//       schoolId,
//       teacherId: teacher._id,
//       month,
//       year,
//       baseSalary: teacher.salary?.basic,
//       allowances: teacher.salary?.allowances,
//       pensionContribution: pension,
//       unpaidLeaveDeduction: leaveDeduction,
//       netSalary: Math.max(0, netSalary),
//       status: 'DRAFT'
//     };
//   });

//   const payrollRecords = await Promise.all(payrollPromises);
//   await Payroll.insertMany(payrollRecords);

//   return successResponse(res, 'Payroll drafted for all teachers', payrollRecords);
// });


/**
 * 1️⃣ Generate Monthly Payroll (DRAFT)
 */
// export const generateMonthlyPayroll = asyncHandler(async (req, res) => {
//   const { month, year } = req.body;
//   const schoolId = req.schoolId;

//   if (!month || !year) {
//     throw new ValidationError('Month and year are required');
//   }

//   // ❌ Prevent duplicate payroll generation
//   const alreadyExists = await Payroll.findOne({ schoolId, month, year });
//   if (alreadyExists) {
//     throw new ValidationError('Payroll already generated for this month');
//   }

//   const teachers = await Teacher.find({ schoolId, status: 'ACTIVE' });
//   if (!teachers.length) {
//     throw new NotFoundError('No active teachers found');
//   }

//   const daysInMonth = new Date(year, month, 0).getDate();

//   const payrollPromises = teachers.map(async (teacher) => {
//     // 🔹 Count unpaid leaves
//     const unpaidLeaves = await LeaveRequest.countDocuments({
//       teacherId: teacher._id,
//       status: 'APPROVED',
//       leaveType: 'UNPAID',
//       startDate: { $gte: new Date(year, month - 1, 1) },
//       endDate: { $lte: new Date(year, month, 0) }
//     });

//     const basic = teacher.salary?.basic || 0;
//     const allowances = teacher.salary?.allowances || 0;

//     const dailyRate = basic / daysInMonth;
//     const unpaidLeaveDeduction = unpaidLeaves * dailyRate;

//     // 🔹 Pension (10%)
//     const pensionContribution = basic * 0.10;

//     const totalDeductions = unpaidLeaveDeduction + pensionContribution;

//     const netSalary = Math.max(
//       0,
//       basic + allowances - totalDeductions
//     );

//     return {
//       schoolId,
//       teacherId: teacher._id,
//       month,
//       year,
//       baseSalary: basic,
//       allowances,
//       pensionContribution,
//       unpaidLeaveDeduction,
//       totalDeductions,
//       netSalary,
//       status: 'DRAFT'
//     };
//   });

//   const payrollRecords = await Promise.all(payrollPromises);
//   await Payroll.insertMany(payrollRecords);

//   return successResponse(res, 'Payroll drafted for all teachers', payrollRecords);
// });

// export const generateMonthlyPayroll = asyncHandler(async (req, res) => {
//   const { month, year } = req.body;
//   const schoolId = req.schoolId;

//   if (!month || !year) throw new ValidationError('Month and year are required');

//   // const existing = await Payroll.findOne({ schoolId, month, year });
//   if (existing) throw new ValidationError('Payroll already generated');

//   const teachers = await Teacher.find({ schoolId, status: 'ACTIVE' });
//   if (!teachers.length) throw new NotFoundError('No active teachers found');

//   const daysInMonth = new Date(year, month, 0).getDate();

//   const payrollRecords = await Promise.all(teachers.map(async (teacher) => {
//     const unpaidLeaves = await LeaveRequest.countDocuments({
//       teacherId: teacher._id,
//       status: 'APPROVED',
//       leaveType: 'UNPAID',
//       startDate: { $gte: new Date(year, month - 1, 1) },
//       endDate: { $lte: new Date(year, month, 0) }
//     });

//     const basic = teacher.salary?.basic || 0;
//     const allowances = teacher.salary?.allowances || 0;

//     const dailyRate = basic / daysInMonth;
//     const unpaidLeaveDeduction = unpaidLeaves * dailyRate;
//     const pensionContribution = basic * 0.10; // 10% PF
//     const taxDeduction = 0; // You can calculate tax if needed

//    let payroll = await Payroll.findOne({
//         schoolId,
//         teacherId: teacher._id,
//         month,
//         year,
//       });

      

//     return {
//       schoolId,
//       teacherId: teacher._id,
//       month,
//       year,
//       baseSalary: basic,
//       allowances,
//       pensionContribution,
//       unpaidLeaveDeduction,
//       taxDeduction,
//       status: 'DRAFT'
//     };
//   }));

//   try {
//     const savedPayrolls = await Payroll.insertMany(payrollRecords);
//     return successResponse(res, 'Payroll drafted successfully', savedPayrolls);
//   } catch (err) {
//     console.error('Payroll save error:', err);
//     throw new ValidationError('Failed to save payroll. Check schema fields.');
//   }
// });

export const generateMonthlyPayroll = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  const schoolId = req.schoolId;

  if (!month || !year) {
    throw new ValidationError('Month and year are required');
  }

  const teachers = await Teacher.find({ schoolId, status: 'ACTIVE' });
  if (!teachers.length) {
    throw new NotFoundError('No active teachers found');
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  const payrollResults = [];

  for (const teacher of teachers) {
    const unpaidLeaves = await LeaveRequest.countDocuments({
      teacherId: teacher._id,
      status: 'APPROVED',
      leaveType: 'UNPAID',
      startDate: { $gte: new Date(year, month - 1, 1) },
      endDate: { $lte: new Date(year, month, 0) },
    });

    const basic = teacher.salary?.basic || 0;
    const allowances = teacher.salary?.allowances || 0;

    const dailyRate = daysInMonth ? basic / daysInMonth : 0;
    const unpaidLeaveDeduction = unpaidLeaves * dailyRate;
    const pensionContribution = basic * 0.10; // 10% PF
    const taxDeduction = 0;

    const totalDeductions =
      pensionContribution + unpaidLeaveDeduction + taxDeduction;

    const netSalary = basic + allowances - totalDeductions;

    let payroll = await Payroll.findOne({
      schoolId,
      teacherId: teacher._id,
      month,
      year,
    });

    // 🔁 UPDATE (only if DRAFT)
    if (payroll) {
      if (payroll.status !== 'DRAFT') {
        payrollResults.push(payroll);
        continue;
      }

      payroll.baseSalary = basic;
      payroll.allowances = allowances;
      payroll.pensionContribution = pensionContribution;
      payroll.unpaidLeaveDeduction = unpaidLeaveDeduction;
      payroll.taxDeduction = taxDeduction;
      payroll.totalDeductions = totalDeductions;
      payroll.netSalary = netSalary;

      await payroll.save();
      payrollResults.push(payroll);
      continue;
    }

    // ➕ CREATE
    payroll = await Payroll.create({
      schoolId,
      teacherId: teacher._id,
      month,
      year,
      baseSalary: basic,
      allowances,
      pensionContribution,
      unpaidLeaveDeduction,
      taxDeduction,
      totalDeductions,
      netSalary,
      status: 'DRAFT',
    });

    payrollResults.push(payroll);
  }

  return successResponse(
    res,
    'Payroll generated/updated successfully',
    payrollResults
  );
});


/**
 * 2️⃣ Get Monthly Payroll List (Admin View)
 */
// export const getMonthlyPayroll = asyncHandler(async (req, res) => {
//   const { month, year } = req.query;
//   const schoolId = req.schoolId;

//   if (!month || !year) {
//     throw new ValidationError('Month and year are required');
//   }

//   const payrolls = await Payroll.find({ schoolId, month, year })
//     .populate('teacherId', 'name email phone')
//     .sort({ createdAt: -1 });

//   return successResponse(res, 'Payroll fetched successfully', payrolls);
// });

export const getMonthlyPayroll = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const schoolId = req.schoolId;

  if (!month || !year) {
    throw new ValidationError("Month and year are required");
  }

  const teachers = await Teacher.find({
    schoolId,
    status: "ACTIVE",
  });

  const payrolls = [];

  for (const teacher of teachers) {
    let payroll = await Payroll.findOne({
      schoolId,
      teacherId: teacher._id,
      month,
      year,
    }).populate("teacherId", "name email phone");

    // ❗ Auto-create missing payroll
    if (!payroll) {
      const basic = teacher.salary?.basic || 0;
      const allowances = teacher.salary?.allowances || 0;
      const pension = basic * 0.1;

      payroll = await Payroll.create({
        schoolId,
        teacherId: teacher._id,
        month,
        year,
        baseSalary: basic,
        allowances,
        pensionContribution: pension,
        unpaidLeaveDeduction: 0,
        taxDeduction: 0,
        totalDeductions: pension,
        netSalary: basic + allowances - pension,
        status: "DRAFT",
      });

      await payroll.populate("teacherId", "name email phone");
    }

    payrolls.push(payroll);
  }

  return successResponse(res, "Payroll fetched", payrolls);
});

/**
 * 3️⃣ Mark Payroll as PAID
 */
export const markPayrollPaid = asyncHandler(async (req, res) => {
  const { payrollId } = req.params;

  const payroll = await Payroll.findById(payrollId);
  if (!payroll) {
    throw new NotFoundError('Payroll record not found');
  }

  payroll.status = 'PAID';
  payroll.paymentDate = new Date();
  payroll.transactionId = `TXN-${Date.now()}`;

  await payroll.save();

  return successResponse(res, 'Salary marked as paid', payroll);
});

/**
 * 4️⃣ Get Single Teacher Payroll History
 */
export const getTeacherPayrollHistory = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  console.log("Teacher ID param:", req.params.teacherId);


  const payrolls = await Payroll.find({ teacherId })
    .sort({ year: -1, month: -1 });

  return successResponse(res, 'Teacher payroll history fetched', payrolls);
});

/**
 * 5️⃣ Delete Draft Payroll (optional – safety)
 */
export const deleteDraftPayroll = asyncHandler(async (req, res) => {
  const { payrollId } = req.params;

  const payroll = await Payroll.findById(payrollId);
  if (!payroll) {
    throw new NotFoundError('Payroll not found');
  }

  if (payroll.status !== 'DRAFT') {
    throw new ValidationError('Only draft payroll can be deleted');
  }

  await payroll.deleteOne();

  return successResponse(res, 'Draft payroll deleted successfully');
});

export const updateTeacherSalary = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const { salary } = req.body;

  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw new NotFoundError("Teacher not found");
  }

  teacher.salary = {
    basic: salary.basic || 0,
    allowances: salary.allowances || 0
  };

  await teacher.save();

  return successResponse(res, "Salary updated successfully", teacher);
});


export const updatePayroll = asyncHandler(async (req, res) => {
   const { id } = req.params;
  const { unpaidLeaveDeduction = 0, taxDeduction = 0 } = req.body;
  const schoolId = req.schoolId;

  // 1️⃣ Find payroll by ID + school
  const payroll = await Payroll.findOne({
    _id: id,
    schoolId,
  });

  if (!payroll) {
    throw new NotFoundError("Payroll not found");
  }

  // 2️⃣ Lock if PAID
  if (payroll.status === "PAID") {
    throw new ValidationError("Paid payroll cannot be updated");
  }

  // 3️⃣ Get teacher
  const teacher = await Teacher.findOne({
    _id: payroll.teacherId,
    schoolId,
  });

  if (!teacher) {
    throw new NotFoundError("Teacher not found");
  }

  const basic = teacher.salary?.basic || 0;
  const allowances = teacher.salary?.allowances || 0;

  // 4️⃣ Update payroll
  payroll.baseSalary = basic;
  payroll.allowances = allowances;
  payroll.pensionContribution = basic * 0.1;
  payroll.unpaidLeaveDeduction = unpaidLeaveDeduction;
  payroll.taxDeduction = taxDeduction;

  await payroll.save(); // pre('save') handles totals

  return successResponse(res, "Payroll updated successfully", payroll);
});


// export const updatePayroll = asyncHandler(async (req, res) => {
//   const {
//     teacherId,
//     month,
//     year,
//     unpaidLeaveDeduction = 0,
//     taxDeduction = 0,
//     status = "DRAFT",
//   } = req.body;

//   // 1️⃣ Find payroll
//   const payroll = await Payroll.findOne({ teacherId, month, year });
//   if (!payroll) {
//     throw new NotFoundError("Payroll not found for this month");
//   }

//   // 2️⃣ Get latest teacher salary
//   const teacher = await Teacher.findById(teacherId);
//   if (!teacher) {
//     throw new NotFoundError("Teacher not found");
//   }

//   const basic = teacher.salary.basic || 0;
//   const allowances = teacher.salary.allowances || 0;
//   const pensionContribution = basic * 0.1;

//   // 3️⃣ Update payroll fields
//   payroll.baseSalary = basic;
//   payroll.allowances = allowances;
//   payroll.pensionContribution = pensionContribution;
//   payroll.unpaidLeaveDeduction = unpaidLeaveDeduction;
//   payroll.taxDeduction = taxDeduction;
//   payroll.status = status;

//   // totalDeductions & netSalary → schema pre('save') handle karega
//   await payroll.save();

//   return successResponse(res, "Payroll updated successfully", payroll);
// });