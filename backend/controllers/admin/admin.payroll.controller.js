// controllers/admin/admin.payroll.controller.js
import mongoose from 'mongoose';
import School from '../../models/School.js';
import Staff from '../../models/StaffSalaryPolicy.js';
import Payroll from '../../models/Payroll.js';
import Teacher from '../../models/Teacher.js';
import StaffAttendance from '../../models/StaffAttendance.js';
import PDFDocument from 'pdfkit';
import LeaveRequest from '../../models/LeaveRequest.js';
import Admin from '../../models/Admin.js';
import SchoolPolicy from '../../models/StaffSalaryPolicy.js';
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
      const totalDaysInMonth = new Date(year, month, 0).getDate();
      
      // Bypass attendance calculation, grant full attendance
      const presentDays = totalDaysInMonth;
      const paidLeaves = 0; 
      const lwp = 0;
      const attendanceFactor = 1;

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

  // ✅ 1. Fetch Global School Policy
  let policy = await SchoolPolicy.findOne({ schoolId });

  // Agar policy nahi bani, toh default 2026 standards use karo
  const bPct = (policy?.payrollSettings?.basicPercent || 50) / 100;
  const hPct = (policy?.payrollSettings?.hraPercent || 20) / 100;
  const dPct = (policy?.payrollSettings?.daPercent || 10) / 100;

  const basic = monthlyGross * bPct;
  const da = basic * dPct;
  const hra = basic * hPct;
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

// ✅ POST: Run monthly payroll with Manual Override support
export const runMonthlyPayroll = asyncHandler(async (req, res) => {
  const { month, year, employeeIds, extraEarnings, manualAmount } = req.body; 
  const schoolId = req.schoolId;

  const results = { success: [], failed: [] };
  
  const workingDaysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
  const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

  for (const employeeId of employeeIds) {
    try {
      const structure = await Payroll.findOne({ employeeId, schoolId, isTemplate: true });
      if (!structure) {
        results.failed.push({ 
          employeeId, 
          reason: "Salary structure not set. Please configure salary first." 
        });
        continue;
      }

      // Full attendance granted regardless of records
      const totalPaidDays = workingDaysInMonth;
      const attendanceFactor = 1;
      
      // 🚀 MANUAL OVERRIDE LOGIC
      let baseGross;
      let overrideFactor;

      if (manualAmount && Number(manualAmount) > 0) {
        // Use forced amount as base gross
        baseGross = Number(manualAmount);
        // Calculate factor based on forced amount vs template gross
        overrideFactor = baseGross / structure.grossSalary; 
      } else {
        // Normal logic (Full gross salary without attendance penalty)
        baseGross = structure.grossSalary;
        overrideFactor = 1;
      }

      // Extra Activities (Trips/Bonus)
      const extras = extraEarnings?.[employeeId] || [];
      const totalExtra = extras.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const finalMonthlyGross = baseGross + totalExtra;

      // Components calculation using overrideFactor
      const monthlyBasic = Math.round(structure.earnings.basic * overrideFactor);
      const monthlyHRA = Math.round(structure.earnings.hra * overrideFactor);
      const monthlyDA = Math.round((structure.earnings.da || 0) * overrideFactor);
      const monthlySpecial = baseGross - (monthlyBasic + monthlyHRA + monthlyDA); 
      
      // PF Calculation on forced components
      let pfBasis = monthlyBasic + monthlyDA;
      if (structure.limitPF && pfBasis > 15000) pfBasis = 15000;
      const epfEmployee = Math.round(pfBasis * 0.12);

      const monthlySlip = new Payroll({
        schoolId,
        employeeId,
        month: month.toString(),
        year: parseInt(year),
        ctc: structure.ctc,
        grossSalary: finalMonthlyGross,
        earnings: {
          basic: monthlyBasic,
          hra: monthlyHRA,
          da: monthlyDA,
          specialAllowance: monthlySpecial > 0 ? monthlySpecial : 0,
          extraActivities: extras
        },
        deductions: {
          epfEmployee,
          professionalTax: 200,
          tds: structure.deductions.tds || 0
        },
        statutory: structure.statutory,
        netSalary: finalMonthlyGross - (epfEmployee + 200 + (structure.deductions.tds || 0)),
        taxRegime: structure.taxRegime,
        isTemplate: false,
        attendanceDays: totalPaidDays,
        paymentStatus: 'PENDING'
      });

      await monthlySlip.save();
      results.success.push({ employeeId, slipId: monthlySlip._id });
    } catch (err) {
      results.failed.push({ employeeId, reason: err.message });
    }
  }
  
  if (results.success.length === 0 && results.failed.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Payroll generation failed for all selected staff.",
      details: results.failed
    });
  }

  const msg = results.failed.length > 0 
    ? `Generated ${results.success.length} slips, but ${results.failed.length} failed.`
    : "Payroll run completed successfully";

  return successResponse(res, msg, results);
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
    const currentMonth = (new Date().getMonth() + 1).toString();
    const currentYear = new Date().getFullYear();

    // 1. Get all active staff
    const teachers = await Teacher.find({ schoolId, isActive: true }).select('name teacherID department') || [];
    const admins = await Admin.find({ schoolId, isActive: true }).select('name adminID department') || [];
    const allStaff = [...teachers, ...admins];

    // 2. Fetch ALL structures and ALL processed slips for this month
    const [structures, currentMonthPayrolls] = await Promise.all([
        Payroll.find({ schoolId, isTemplate: true }).select('employeeId grossSalary'),
        Payroll.find({ schoolId, month: currentMonth, year: currentYear, isTemplate: false })
    ]);

    // 3. Map status for each member
    const staffWithStatus = allStaff.map(s => {
        // Find master setup
        const structure = structures.find(st => st.employeeId.toString() === s._id.toString());
        // Find if slip already generated this month
        const slip = currentMonthPayrolls.find(p => p.employeeId.toString() === s._id.toString());
        
        return {
            ...s.toObject(),
            hasStructure: !!structure,
            // ✅ FIX: Use structure gross, fallback to slip gross, then 0
            monthlyGross: structure?.grossSalary || slip?.grossSalary || 0,
            payrollStatus: slip ? slip.paymentStatus : (structure ? "READY" : "NOT_CONFIGURED")
        };
    });

    const paidTotal = currentMonthPayrolls.filter(p => p.paymentStatus === 'PAID').reduce((sum, p) => sum + (p.netSalary || 0), 0);
    const pendingTotal = currentMonthPayrolls.filter(p => p.paymentStatus !== 'PAID').reduce((sum, p) => sum + (p.netSalary || 0), 0);

    return successResponse(res, "Payroll summary retrieved", {
        paid: Math.round(paidTotal),
        pending: Math.round(pendingTotal),
        totalStaff: allStaff.length,
        staffList: staffWithStatus,
        processedCount: currentMonthPayrolls.length
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
  const { transactionId, paymentMode } = req.body; // IMPS, NEFT, etc.
  const schoolId = req.schoolId;

  if (!transactionId) throw new ValidationError("Transaction ID is required");

  const slip = await Payroll.findOneAndUpdate(
    { _id: slipId, schoolId, isTemplate: false },
    {
      paymentStatus: 'PAID',
      paymentDate: new Date(),
      transactionId: transactionId.toUpperCase(),
      paymentMode: paymentMode || 'NEFT',
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  );

  if (!slip) {
    throw new NotFoundError("Payroll slip not found");
  }

  return successResponse(res, "Payment status updated to PAID", slip);
});
// ✅ POST controller for frontend to update school payroll policy

// controllers/admin/admin.payroll.controller.js mein add karein

export const updateSchoolPayrollPolicy = asyncHandler(async (req, res) => {
    const { basicPercent, hraPercent, daPercent } = req.body;
    const schoolId = req.schoolId;

    const policy = await SchoolPolicy.findOneAndUpdate(
        { schoolId },
        { 
            payrollSettings: { 
                basicPercent: Number(basicPercent), 
                hraPercent: Number(hraPercent), 
                daPercent: Number(daPercent) 
            } 
        },
        { upsert: true, new: true }
    );

    return successResponse(res, "Global school policy updated", policy);
});

// ✅ GET controller for frontend to fetch school payroll policy
export const getSchoolPayrollPolicy = asyncHandler(async (req, res) => {
    const schoolId = req.schoolId;
    const policy = await SchoolPolicy.findOne({ schoolId });
    
    // ✅ DEFAULT GOVT NORMS (2026)
    const defaultSettings = {
        payrollSettings: { 
            basicPercent: 50, 
            hraPercent: 20, 
            daPercent: 10 
        }
    };

    // Agar DB mein policy nahi hai, toh default bhej do
    return successResponse(res, "Policy retrieved", policy || defaultSettings);
});

// ✅ GET: Get monthly payroll list (FIXED for your DB structure)
export const getMonthlyPayroll = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const schoolId = req.schoolId;

  if (!month || !year) throw new ValidationError("Month and Year are required");

  // Query specifically using the string format
  // Note: .lean() hatane ki zaroorat nahi hai, bas niche logic change karni hai
  const payrolls = await Payroll.find({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    month: month.toString(),
    year: parseInt(year),
    isTemplate: false
  }).sort({ createdAt: -1 }).lean(); // Lean is good for performance

  const enrichedPayrolls = await Promise.all(payrolls.map(async (payroll) => {
    let staff = await Teacher.findById(payroll.employeeId).select('name teacherID');
    if (!staff) staff = await Admin.findById(payroll.employeeId).select('name adminID');

    return {
      ...payroll, // ✅ FIX: toObject() call karne ki zaroorat nahi kyunki lean() pehle se object deta hai
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
  const { monthlyGross, limitPF, taxRegime } = req.body;
  const schoolId = req.schoolId;

  if (!monthlyGross) {
    throw new ValidationError("Monthly Gross Salary is required");
  }

  // Re-calculate components based on new gross
  const basic = monthlyGross * 0.50;
  const da = basic * 0.10;
  const hra = basic * 0.20;
  const specialAllowance = monthlyGross - (basic + da + hra);

  let pfBasis = basic + da;
  if (limitPF && pfBasis > 15000) pfBasis = 15000;
  const epfEmployee = pfBasis * 0.12;
  const epfEmployer = pfBasis * 0.12;

  const gratuityProvision = (basic + da) / 26 * 15 / 12;

  const annualTaxable = (monthlyGross * 12) - 75000;
  let annualTds = 0;
  if (annualTaxable > 1200000) {
    annualTds = (annualTaxable - 1200000) * 0.10;
  }
  const monthlyTds = annualTds / 12;

  const netSalary = monthlyGross - (epfEmployee + monthlyTds + 200);

  const updated = await Payroll.findOneAndUpdate(
    { employeeId: teacherId, schoolId, isTemplate: true },
    {
      ctc: monthlyGross + epfEmployer + gratuityProvision,
      grossSalary: monthlyGross,
      earnings: { basic, da, hra, specialAllowance },
      deductions: { epfEmployee, tds: monthlyTds, professionalTax: 200 },
      statutory: { epfEmployer, gratuityProvision },
      netSalary,
      taxRegime: taxRegime || 'NEW'
    },
    { new: true, runValidators: true, upsert: true }
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
      
      // Bypass attendance fetching - grant full attendance
      const presentDays = workingDaysInMonth;
      const paidLeaves = 0;
      const paidDays = workingDaysInMonth;
      const attendanceFactor = 1;
      
      // Calculate salary based on full gross
      const monthlyGross = structure.grossSalary;
      const monthlyBasic = structure.earnings.basic;
      const monthlyDA = structure.earnings.da;
      
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
          hra: structure.earnings.hra,
          specialAllowance: structure.earnings.specialAllowance
        },
        deductions: {
          ...structure.deductions,
          epfEmployee
        },
        statutory: structure.statutory,
        netSalary: netPayable,
        taxRegime: structure.taxRegime,
        isTemplate: false,
        month:month.toString(),
        year:Number(year),
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
  if (!slip) throw new NotFoundError("Salary slip");

  // ✅ FIX: Added 'salary' and 'panNumber' in the select string
  let staff = await Teacher.findById(slip.employeeId).select('name teacherID department phone panNumber salary email') || 
              await Admin.findById(slip.employeeId).select('name adminID department phone panNumber salary email');

  if (!staff) throw new NotFoundError("Staff record not found");

  return successResponse(res, "Slip details retrieved", { slip, staff });
});

// ✅ GET: Fetch monthly matrix for all staff
export const getAttendanceMatrix = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const schoolId = req.schoolId;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // 1. Saare active staff le aao
  const teachers = await Teacher.find({ schoolId, isActive: true }).select('name teacherID profilePicture').lean();
  const admins = await Admin.find({ schoolId, isActive: true }).select('name adminID profilePicture').lean();
  const allStaff = [...teachers, ...admins];

  // 2. Iss mahine ke saare attendance records fetch karo
  const attendanceRecords = await StaffAttendance.find({
    schoolId,
    date: { $gte: startDate, $lte: endDate }
  }).lean();

  // 3. Matrix structure taiyar karo
  const matrix = allStaff.map(staff => {
    const staffAttendance = {};
    
    // Har staff ke liye records ko date ke hisaab se map karo
    attendanceRecords
      .filter(r => r.teacherId.toString() === staff._id.toString())
      .forEach(r => {
        const dateKey = new Date(r.date).getDate(); // Get day 1, 2, 3...
        staffAttendance[dateKey] = r.status; // PRESENT, ABSENT, etc.
      });

    return {
      _id: staff._id,
      name: staff.name,
      displayID: staff.teacherID || staff.adminID,
      profilePicture: staff.profilePicture,
      schoolId: schoolId,
      attendance: staffAttendance
    };
  });

  return successResponse(res, "Matrix retrieved", {
    daysInMonth: new Date(year, month, 0).getDate(),
    matrix
  });
});

// ✅ GET: Download salary slip as PDF (Refined & Fixed)
export const downloadSalarySlip = asyncHandler(async (req, res) => {
    const { slipId } = req.params;
    const schoolId = req.schoolId;

    const monthNames = [
        "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    ];

    const slip = await Payroll.findOne({ _id: slipId, schoolId }).lean();
    if (!slip) throw new NotFoundError("Salary slip not found");

    // ✅ FIX 1: Strict query for all required fields
    const staff = await Teacher.findById(slip.employeeId).select('name teacherID department panNumber salary email') || 
                  await Admin.findById(slip.employeeId).select('name adminID department panNumber salary email');
    
    if (!staff) throw new NotFoundError("Staff member not found");

    const school = await School.findById(schoolId).lean(); 

    // ✅ Convert numeric month "1" to name "JANUARY"
    const displayMonth = isNaN(slip.month) ? slip.month : monthNames[parseInt(slip.month) - 1];

    // ✅ FIX 2: Single Header Set (Remove duplicates)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SalarySlip_${staff.name.replace(/\s+/g, '_')}_${displayMonth}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    try {
        // --- 🏢 Header ---
        doc.fillColor('#1e3a8a').fontSize(20).font('Helvetica-Bold').text(school?.schoolName?.toUpperCase() || 'SCHOOL NAME', { align: 'center' });
        doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(school?.address?.city || '', { align: 'center' }).moveDown(2);

        // ✅ FIX 3: Single Title (Removed duplicate)
        doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text(`PAYSLIP FOR ${displayMonth} ${slip.year}`, { align: 'center', underline: true });
        doc.moveDown(2);

        // --- 👤 Employee Info Box ---
        const startY = doc.y;
        doc.rect(50, startY, 500, 85).stroke('#cbd5e1');
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text('Employee Name:', 65, startY + 15); 
        doc.font('Helvetica').text(staff.name || 'N/A', 165, startY + 15);

        doc.font('Helvetica-Bold').text('Employee ID:', 65, startY + 35); 
        doc.font('Helvetica').text(staff.teacherID || staff.adminID || 'N/A', 165, startY + 35);

        doc.font('Helvetica-Bold').text('Department:', 65, startY + 55); 
        doc.font('Helvetica').text(staff.department || 'Teaching', 165, startY + 55);
        
        // ✅ FIX 4: Correct mapping for Bank and PAN
        doc.font('Helvetica-Bold').text('PAN No:', 310, startY + 15); 
        doc.font('Helvetica').text(staff.panNumber || 'N/A', 390, startY + 15);

        // ✅ Logic: Agar PAN hai toh number dikhao, warna "NOT PROVIDED" ya dash
        const panToShow = staff.panNumber && staff.panNumber.trim() !== "" 
            ? staff.panNumber 
            : "----------"; 
        doc.font('Helvetica').text(panToShow, 390, startY + 15);

        doc.font('Helvetica-Bold').text('Bank A/c:', 310, startY + 35); 
        const accNo = staff.salary?.bankDetails?.accountNumber || 'N/A';
        doc.font('Helvetica').text(accNo, 390, startY + 35);
        
        doc.font('Helvetica-Bold').text('Regime:', 310, startY + 55); 
        doc.font('Helvetica').text(slip.taxRegime || 'NEW', 390, startY + 55);

        doc.moveDown(6);

        // --- 💰 Salary Table (Breakdown logic is correct, just ensuring safety) ---
        const tableTop = doc.y;
        doc.rect(50, tableTop, 500, 20).fill('#f1f5f9').stroke('#cbd5e1');
        doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold');
        doc.text('EARNINGS', 65, tableTop + 6);
        doc.text('AMOUNT', 210, tableTop + 6);
        doc.text('DEDUCTIONS', 310, tableTop + 6);
        doc.text('AMOUNT', 460, tableTop + 6);

        let rowY = tableTop + 30;
        doc.fillColor('#000000').font('Helvetica');
        
        doc.text('Basic Pay', 65, rowY); doc.text(`Rs. ${Math.round(slip.earnings?.basic || 0).toLocaleString()}`, 210, rowY);
        doc.text('EPF Employee', 310, rowY); doc.text(`Rs. ${Math.round(slip.deductions?.epfEmployee || 0).toLocaleString()}`, 460, rowY);
        
        doc.text('DA', 65, rowY + 20); doc.text(`Rs. ${Math.round(slip.earnings?.da || 0).toLocaleString()}`, 210, rowY + 20);
        doc.text('Prof. Tax (PT)', 310, rowY + 20); doc.text(`Rs. ${Math.round(slip.deductions?.professionalTax || 200).toLocaleString()}`, 460, rowY + 20);

        doc.text('HRA', 65, rowY + 40); doc.text(`Rs. ${Math.round(slip.earnings?.hra || 0).toLocaleString()}`, 210, rowY + 40);
        doc.text('TDS', 310, rowY + 40); doc.text(`Rs. ${Math.round(slip.deductions?.tds || 0).toLocaleString()}`, 460, rowY + 40);

        doc.text('Special Allw.', 65, rowY + 60); doc.text(`Rs. ${Math.round(slip.earnings?.specialAllowance || 0).toLocaleString()}`, 210, rowY + 60);

        let currentY = rowY + 80;

        if (slip.earnings?.extraActivities && Array.isArray(slip.earnings.extraActivities)) {
            slip.earnings.extraActivities.forEach(act => {
                if (act.amount > 0) {
                    doc.text(`Extra (${act.remark || 'Activity'})`, 65, currentY); 
                    doc.text(`Rs. ${Number(act.amount).toLocaleString()}`, 210, currentY);
                    currentY += 20;
                }
            });
        } else if (slip.earnings?.extraActivityPay > 0) {
            doc.text(`Extra (${slip.earnings.activityRemarks || 'Activity'})`, 65, currentY); 
            doc.text(`Rs. ${Number(slip.earnings.extraActivityPay).toLocaleString()}`, 210, currentY);
            currentY += 20;
        }

        // --- 💵 Footer ---
        doc.y = currentY + 30;
        const footerY = doc.y;
        doc.rect(50, footerY, 500, 35).fill('#1e3a8a');
        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold');
        doc.text('NET TAKE-HOME PAY:', 65, footerY + 12);
        doc.fontSize(14).text(`Rs. ${Math.round(slip.netSalary || 0).toLocaleString()}`, 350, footerY + 12, { align: 'right', width: 180 });

        if (slip.paymentStatus === 'PAID') {
            doc.moveDown();
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#059669'); // Green color
            doc.text(`PAYMENT CONFIRMED`, { align: 'center' });
            doc.fontSize(9).fillColor('#475569').text(`Transaction ID: ${slip.transactionId}`, { align: 'center' });
            doc.text(`Payment Date: ${new Date(slip.paymentDate).toLocaleDateString('en-IN')}`, { align: 'center' });
        }

        doc.moveDown(4);
        doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('This is a system-generated payslip and does not require a physical signature.', { align: 'center' });

    } catch (error) {
        console.error('Error drawing PDF:', error);
    }

    doc.end();
});

// ✅ GET: Kisi bhi staff (Admin/Teacher) ke liye apni history dekhna
export const getMySalaryHistory = asyncHandler(async (req, res) => {
    const userId = req.user.id; // Logged in user's ID
    const schoolId = req.schoolId;

    const history = await Payroll.find({
        employeeId: userId,
        schoolId,
        isTemplate: false 
    }).sort({ year: -1, month: -1 });

    return successResponse(res, "Your salary history retrieved", history);
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
  getPayrollDetails,
  downloadSalarySlip,
  getMySalaryHistory,
  getAttendanceMatrix,
  updateSchoolPayrollPolicy,
  getSchoolPayrollPolicy
};