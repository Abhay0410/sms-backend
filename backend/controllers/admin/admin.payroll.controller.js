// controllers/admin/admin.payroll.controller.js
import mongoose from 'mongoose';
import Payroll from '../../models/Payroll.js';
import Teacher from '../../models/Teacher.js';
import StaffAttendance from '../../models/StaffAttendance.js';
import Admin from '../../models/Admin.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// ✅ GET: Fetch attendance stats for payroll preparation (for Teachers & Admins)
export const getAttendanceStats = asyncHandler(async (req, res) => {
  const month = parseInt(req.query.month);
  const year = parseInt(req.query.year);
  const schoolId = req.schoolId;

  if (!month || !year) {
    throw new ValidationError("Month and Year are required");
  }

  // Define the date range for the selected month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const teachers = await Teacher.find({ schoolId, isActive: true }).select('name teacherID _id');
  const admins = await Admin.find({ schoolId, isActive: true }).select('name adminID _id');

  const processStats = async (staff, type) => {
    return await Promise.all(staff.map(async (member) => {
      // ✅ FIX: Query StaffAttendance with date range
      const records = await StaffAttendance.find({
        teacherId: member._id, // StaffAttendance uses 'teacherId' for both roles
        schoolId: new mongoose.Types.ObjectId(schoolId),
        date: { $gte: startDate, $lte: endDate }
      });

      const totalDaysInMonth = new Date(year, month, 0).getDate();
      
      // ✅ FIX: Match status strings from your markAttendance logic
      const presentDays = records.filter(r => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
      
      // Logic for Paid Leaves from your LeaveRequest model would go here if synced
      const paidLeaves = 0; 
      
      const lwp = records.filter(r => r.status === 'ABSENT').length;
      
      const attendanceFactor = totalDaysInMonth > 0 ? (presentDays + paidLeaves) / totalDaysInMonth : 0;

      return {
        teacherId: member._id,
        name: member.name,
        teacherID: member.teacherID || member.adminID,
        employeeType: type,
        totalDays: totalDaysInMonth,
        presentDays,
        paidLeaves,
        lwp,
        attendanceFactor: parseFloat(attendanceFactor.toFixed(2))
      };
    }));
  };

  const stats = [
    ...(await processStats(teachers, 'teacher')),
    ...(await processStats(admins, 'admin'))
  ];

  return successResponse(res, "Attendance statistics retrieved", stats);
});

// ✅ POST: Calculate and set salary structure for employee
export const calculateAndSetSalary = asyncHandler(async (req, res) => {
  const { employeeId, monthlyGross, taxRegime, limitPF, employeeType } = req.body;
  const schoolId = req.schoolId;

  if (!employeeId || !monthlyGross) {
    throw new ValidationError("Employee ID and Monthly Gross are required");
  }

  // 1. Basic = 50% of Gross (New Wage Code 2026)
  const basic = monthlyGross * 0.50;
  
  // 2. DA (Example 10% of Basic) and HRA (Example 20% of Basic)
  const da = basic * 0.10;
  const hra = basic * 0.20;
  const specialAllowance = monthlyGross - (basic + da + hra);

  // 3. EPF Calculation (12% of Basic + DA)
  let pfBasis = basic + da;
  if (limitPF && pfBasis > 15000) pfBasis = 15000; // Statutory Ceiling
  const epfEmployee = pfBasis * 0.12;
  const epfEmployer = pfBasis * 0.12;

  // 4. Gratuity Provision (Monthly liability for Admin)
  const gratuityProvision = (basic + da) / 26 * 15 / 12;

  // 5. TDS Estimation (Simplified for 2026 New Regime)
  const annualTaxable = (monthlyGross * 12) - 75000;
  let annualTds = 0;
  if (annualTaxable > 1200000) {
    annualTds = (annualTaxable - 1200000) * 0.10;
  }
  const monthlyTds = annualTds / 12;

  const netSalary = monthlyGross - (epfEmployee + monthlyTds + 200); // 200 for PT

  const payrollData = {
    schoolId,
    employeeId,
    employeeType: employeeType || 'teacher',
    ctc: monthlyGross + epfEmployer + gratuityProvision,
    grossSalary: monthlyGross,
    earnings: { basic, da, hra, specialAllowance },
    deductions: { epfEmployee, tds: monthlyTds, professionalTax: 200 },
    statutory: { epfEmployer, gratuityProvision },
    netSalary,
    taxRegime: taxRegime || 'new',
    isTemplate: true,
    month: null,
    year: null,
    paymentStatus: null
  };

  const savedPayroll = await Payroll.findOneAndUpdate(
    { employeeId, schoolId },
    payrollData,
    { upsert: true, new: true, runValidators: true }
  );

  return successResponse(res, "Salary structure saved successfully", savedPayroll);
});

// ✅ POST: Run monthly payroll for selected employees
export const runMonthlyPayroll = asyncHandler(async (req, res) => {
  const { month, year, employeeIds } = req.body;
  const schoolId = req.schoolId;

  const results = { success: [], failed: [] };
  const workingDaysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
  const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

  for (const employeeId of employeeIds) {
    try {
      const structure = await Payroll.findOne({ employeeId, schoolId, isTemplate: true });
      if (!structure) throw new Error("Salary structure not set");

      const attendanceRecords = await StaffAttendance.find({
        teacherId: employeeId,
        schoolId,
        date: { $gte: startDate, $lte: endDate }
      });

      const presentDays = attendanceRecords.filter(r => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
      const attendanceFactor = presentDays / workingDaysInMonth;

      // ✅ Create a CLEAN document to avoid nulls
      const monthlySlip = new Payroll({
        schoolId,
        employeeId,
        month: month.toString(), // Force "1", "2" etc.
        year: year.toString(),   // Force "2026"
        ctc: structure.ctc,
        grossSalary: structure.grossSalary * attendanceFactor,
        earnings: {
          basic: structure.earnings.basic * attendanceFactor,
          da: structure.earnings.da * attendanceFactor,
          hra: structure.earnings.hra * attendanceFactor,
          specialAllowance: structure.earnings.specialAllowance * attendanceFactor
        },
        deductions: structure.deductions,
        statutory: structure.statutory,
        netSalary: (structure.grossSalary * attendanceFactor) - (structure.deductions.epfEmployee + structure.deductions.professionalTax),
        taxRegime: structure.taxRegime,
        isTemplate: false,
        attendanceDays: presentDays,
        paymentStatus: 'PENDING'
      });

      await monthlySlip.save();
      results.success.push({ employeeId, slipId: monthlySlip._id });
    } catch (err) {
      results.failed.push({ employeeId, reason: err.message });
    }
  }
  return successResponse(res, "Payroll run completed", results);
});

// ✅ GET: Unified staff list for payroll selection
export const getUnifiedStaffList = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;

  // 1. Fetch active Teachers
  const teachers = await Teacher.find({ schoolId, isActive: true })
    .select('_id name teacherID role')
    .lean();

  // 2. Fetch active Admins (except superAdmin if you wish)
  const admins = await Admin.find({ schoolId, isActive: true })
    .select('_id name adminID role')
    .lean();

  // 3. Merge and format for the frontend
  const combinedStaff = [
    ...teachers.map(t => ({ 
      ...t, 
      displayID: t.teacherID,
      employeeType: 'teacher',
      role: t.role || 'teacher'
    })),
    ...admins.map(a => ({ 
      ...a, 
      displayID: a.adminID,
      employeeType: 'admin',
      role: a.role || 'admin'
    }))
  ];

  return successResponse(res, "Staff list retrieved successfully", combinedStaff);
});

// ✅ GET: Get payroll summary for dashboard
export const getPayrollSummary = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // 1. Get total active staff (teachers + admins)
  const totalTeachers = await Teacher.countDocuments({ schoolId, isActive: true });
  const totalAdmins = await Admin.countDocuments({ schoolId, isActive: true });
  const totalStaff = totalTeachers + totalAdmins;

  // 2. Get payroll summary for current month
  const payrolls = await Payroll.find({ 
    schoolId, 
    month: currentMonth, 
    year: currentYear,
    isTemplate: false 
  });

  // 3. Calculate totals
  const paid = payrolls
    .filter(p => p.paymentStatus === 'PAID')
    .reduce((sum, p) => sum + (p.netSalary || 0), 0);

  const pending = payrolls
    .filter(p => p.paymentStatus !== 'PAID')
    .reduce((sum, p) => sum + (p.netSalary || 0), 0);

  const totalPayrollCost = paid + pending;

  return successResponse(res, "Payroll summary retrieved", {
    paid,
    pending,
    totalPayrollCost,
    totalStaff,
    breakdown: {
      teachers: totalTeachers,
      admins: totalAdmins
    },
    currentPeriod: `${currentMonth}/${currentYear}`
  });
});

// ✅ GET: Get specific employee's payroll structure
export const getPayrollStructure = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const schoolId = req.schoolId;

  const structure = await Payroll.findOne({ 
    employeeId: teacherId, 
    schoolId,
    isTemplate: true 
  });

  if (!structure) {
    throw new NotFoundError("Payroll structure not found for this employee");
  }

  return successResponse(res, "Payroll structure retrieved", structure);
});

// ✅ PATCH: Mark payroll as paid
export const markPayrollPaid = asyncHandler(async (req, res) => {
  const { slipId } = req.params;
  const { transactionId, paymentMode } = req.body;
  const schoolId = req.schoolId;

  const slip = await Payroll.findOneAndUpdate(
    { _id: slipId, schoolId, isTemplate: false },
    {
      paymentStatus: 'PAID',
      paymentDate: new Date(),
      transactionId,
      paymentMode,
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  );

  if (!slip) {
    throw new NotFoundError("Payroll slip not found or already processed");
  }

  return successResponse(res, "Payroll marked as paid successfully", slip);
});

// ✅ GET: Get monthly payroll list (FIXED for your DB structure)
export const getMonthlyPayroll = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const schoolId = req.schoolId;

  // ✅ Query specifically using the string format
  const payrolls = await Payroll.find({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    month: month.toString(),
    year: year.toString(),
    isTemplate: false
  }).sort({ createdAt: -1 });

  const enrichedPayrolls = await Promise.all(payrolls.map(async (payroll) => {
    // Check Teacher or Admin collection
    let staff = await Teacher.findById(payroll.employeeId).select('name teacherID');
    if (!staff) staff = await Admin.findById(payroll.employeeId).select('name adminID');

    return {
      ...payroll.toObject(),
      employeeName: staff?.name || "Unknown Staff",
      employeeCode: staff?.teacherID || staff?.adminID || "N/A"
    };
  }));

  return successResponse(res, "Payroll list retrieved", enrichedPayrolls);
});

// ✅ DELETE: Delete draft payroll
export const deleteDraftPayroll = asyncHandler(async (req, res) => {
  const { payrollId } = req.params;
  const schoolId = req.schoolId;

  const deleted = await Payroll.findOneAndDelete({
    _id: payrollId,
    schoolId,
    paymentStatus: 'PENDING', // Only allow deletion of pending payrolls
    isTemplate: false
  });

  if (!deleted) {
    throw new NotFoundError("Draft payroll not found or cannot be deleted");
  }

  return successResponse(res, "Draft payroll deleted successfully", deleted);
});

// ✅ PATCH: Update teacher's salary structure
export const updateTeacherSalary = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const updateData = req.body;
  const schoolId = req.schoolId;

  const updated = await Payroll.findOneAndUpdate(
    { employeeId: teacherId, schoolId, isTemplate: true },
    updateData,
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new NotFoundError("Salary structure not found");
  }

  return successResponse(res, "Salary structure updated successfully", updated);
});

// ✅ PATCH: Update specific payroll
export const updatePayroll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const schoolId = req.schoolId;

  // Prevent updating certain fields
  const restrictedFields = ['_id', 'employeeId', 'schoolId', 'createdAt'];
  restrictedFields.forEach(field => delete updateData[field]);

  const updated = await Payroll.findOneAndUpdate(
    { _id: id, schoolId, isTemplate: false },
    updateData,
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new NotFoundError("Payroll not found");
  }

  return successResponse(res, "Payroll updated successfully", updated);
});

// ✅ GET: Get teacher payroll history
export const getTeacherPayrollHistory = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const schoolId = req.schoolId;

  const history = await Payroll.find({
    employeeId: teacherId,
    schoolId,
    isTemplate: false
  }).sort({ year: -1, month: -1 });

  return successResponse(res, "Payroll history retrieved", history);
});

// ✅ POST: Generate monthly payroll in bulk
export const generateMonthlyPayroll = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  const schoolId = req.schoolId;

  if (!month || !year) {
    throw new ValidationError("Month and Year are required");
  }

  // 1. Get all employees with salary structures
  const structures = await Payroll.find({
    schoolId,
    isTemplate: true
  });

  if (structures.length === 0) {
    throw new ValidationError("No salary structures found. Please set up salaries first.");
  }

  const results = { generated: [], skipped: [], errors: [] };

  for (const structure of structures) {
    try {
      // 2. Check if payroll already exists for this month
      const existing = await Payroll.findOne({
        employeeId: structure.employeeId,
        schoolId,
        month,
        year,
        isTemplate: false
      });

      if (existing) {
        results.skipped.push({
          employeeId: structure.employeeId,
          reason: "Payroll already exists for this month"
        });
        continue;
      }

      // 3. Run payroll for this employee (reuse runMonthlyPayroll logic)
      const workingDaysInMonth = new Date(year, month, 0).getDate();
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      
      // Fetch attendance
      const attendanceRecords = await StaffAttendance.find({
        teacherId: structure.employeeId,
        schoolId,
        date: { $gte: startDate, $lte: endDate }
      });

      const presentDays = attendanceRecords.filter(r => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
      const paidLeaves = 0;
      const paidDays = presentDays + paidLeaves;
      const attendanceFactor = paidDays / workingDaysInMonth;
      
      // Calculate salary
      const monthlyGross = structure.grossSalary * attendanceFactor;
      const monthlyBasic = structure.earnings.basic * attendanceFactor;
      const monthlyDA = structure.earnings.da * attendanceFactor;
      
      let pfBasis = monthlyBasic + monthlyDA;
      if (structure.limitPF && pfBasis > 15000) pfBasis = 15000;
      const epfEmployee = pfBasis * 0.12;
      
      const netPayable = monthlyGross - (epfEmployee + structure.deductions.tds + 200);

      // 4. Create payroll
      const payroll = await Payroll.create({
        schoolId,
        employeeId: structure.employeeId,
        employeeType: structure.employeeType,
        ctc: structure.ctc,
        grossSalary: monthlyGross,
        earnings: {
          basic: monthlyBasic,
          da: monthlyDA,
          hra: structure.earnings.hra * attendanceFactor,
          specialAllowance: structure.earnings.specialAllowance * attendanceFactor
        },
        deductions: {
          ...structure.deductions,
          epfEmployee
        },
        statutory: structure.statutory,
        netSalary: netPayable,
        taxRegime: structure.taxRegime,
        isTemplate: false,
        month,
        year,
        attendanceData: {
          totalDays: workingDaysInMonth,
          presentDays,
          paidLeaves,
          unpaidDays: workingDaysInMonth - paidDays,
          attendanceFactor: parseFloat(attendanceFactor.toFixed(2))
        },
        paymentStatus: 'PENDING'
      });

      results.generated.push({
        employeeId: structure.employeeId,
        payrollId: payroll._id,
        netSalary: netPayable
      });

    } catch (err) {
      results.errors.push({
        employeeId: structure.employeeId,
        reason: err.message
      });
    }
  }

  return successResponse(res, "Monthly payroll generated in bulk", results);
});

// ✅ GET: Get single payroll slip details for View/PDF
export const getPayrollDetails = asyncHandler(async (req, res) => {
  const { slipId } = req.params;
  const schoolId = req.schoolId;

  const slip = await Payroll.findOne({ _id: slipId, schoolId }).lean();
  if (!slip) throw new NotFoundError("Salary slip not found");

  // Fetch Employee Details for the Header
  let staff = await Teacher.findById(slip.employeeId).select('name teacherID department phone panNumber email salary.bankDetails');
  if (!staff) staff = await Admin.findById(slip.employeeId).select('name adminID department phone panNumber email salary.bankDetails');

  return successResponse(res, "Slip details retrieved", { slip, staff });
});

export default {
  getAttendanceStats,
  calculateAndSetSalary,
  runMonthlyPayroll,
  getUnifiedStaffList,
  getPayrollSummary,
  getPayrollStructure,
  markPayrollPaid,
  getMonthlyPayroll,
  deleteDraftPayroll,
  updateTeacherSalary,
  updatePayroll,
  getTeacherPayrollHistory,
  generateMonthlyPayroll,
  getPayrollDetails
};