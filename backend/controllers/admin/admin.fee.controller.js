import FeePayment from '../../models/FeePayment.js';
import FeeHead from '../../models/FeeHead.js';
import Student from '../../models/Student.js';
import Class from '../../models/Class.js';
import School from '../../models/School.js';
import mongoose from 'mongoose';
import { generateInstallments } from '../../utils/fee.utils.js';
import PDFDocument from 'pdfkit';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// ==========================================
// 1. FEE HEAD MANAGEMENT (Master Data)
// ==========================================
export const getStudentsWithFees = asyncHandler(async (req, res) => {
  const { academicYear, search, status, month, page = 1, limit = 50 } = req.query;
  const schoolId = req.schoolId;

  let filter = { schoolId, academicYear, role: 'student' };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { studentID: { $regex: search, $options: 'i' } },
      { className: { $regex: search, $options: 'i' } },
    ];
  }

  const students = await Student.paginate(filter, { page: parseInt(page), limit: parseInt(limit), lean: true });
  const studentsWithFees = [];
  const monthPrefix = month && month !== "ALL" ? month.substring(0, 3).toUpperCase() : null;

  for (const student of students.docs) {
    const fp = await FeePayment.findOne({ student: student._id, academicYear, schoolId }).lean();
    if (!fp) continue;

    let dPaid = fp.totalPaid, dTotal = fp.totalDue, dStatus = fp.status;

    if (monthPrefix) {
      // 🔥 EXACT MATCH FIX: Find the specific month (e.g., JAN)
      const target = fp.installments.find(i => i.name.toUpperCase().startsWith(monthPrefix));
      if (target) {
        dPaid = target.paidAmount; 
        dTotal = target.amount; 
        dStatus = target.status;
      } else {
        // If the student doesn't have an installment for this specific month
        dPaid = 0; dTotal = 0; dStatus = "N/A";
      }
    }

    // Filter Logic: A student is "Paid" for the selected context (Month or Year)
    const isActuallyPaid = dStatus === "PAID" || (dTotal > 0 && dPaid >= dTotal);
    
    if (status === "paid" && !isActuallyPaid) continue;
    if (status === "unpaid" && isActuallyPaid) continue;

    studentsWithFees.push({
      ...student,
      feeDetails: {
        totalFee: dTotal,
        paidAmount: dPaid,
        pendingAmount: Math.max(0, dTotal - dPaid),
        status: isActuallyPaid ? "PAID" : dStatus,
        installments: fp.installments
      }
    });
  }
  return successResponse(res, "Fetched", { 
    students: studentsWithFees, 
    pagination: { current: students.page, pages: students.totalPages, total: students.totalDocs } 
  });
});

export const createFeeHead = asyncHandler(async (req, res) => {
  const { name, type, description } = req.body;
  const feeHead = await FeeHead.create({
    schoolId: req.schoolId,
    name,
    type: type || 'TUITION',
    description: description || ''
  });
  return successResponse(res, 'Fee Head created successfully', feeHead);
});

export const getFeeHeads = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const filter = { schoolId: req.schoolId };
  if (type) filter.type = type;
  const heads = await FeeHead.find(filter).sort({ name: 1 });
  return successResponse(res, 'Fee Heads retrieved successfully', heads);
});

export const updateFeeHead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, type, description } = req.body;
  const feeHead = await FeeHead.findOneAndUpdate(
    { _id: id, schoolId: req.schoolId },
    { name, type, description },
    { new: true, runValidators: true }
  );
  if (!feeHead) throw new NotFoundError('Fee Head');
  return successResponse(res, 'Fee Head updated successfully', feeHead);
});

export const deleteFeeHead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const usedInClass = await Class.findOne({
    schoolId: req.schoolId,
    'feeStructure.head': id
  });
  if (usedInClass) {
    throw new ValidationError('Cannot delete fee head. It is being used in class fee structures.');
  }
  const feeHead = await FeeHead.findOneAndDelete({ _id: id, schoolId: req.schoolId });
  if (!feeHead) throw new NotFoundError('Fee Head');
  return successResponse(res, 'Fee Head deleted successfully');
});

// ==========================================
// 2. CLASS FEE STRUCTURE (Enhanced with Fee Heads)
// ==========================================

export const getClassFeeStructures = asyncHandler(async (req, res) => {
  const { academicYear } = req.query;
  const classes = await Class.find({ schoolId: req.schoolId, academicYear })
    .select('className classNumeric academicYear sections feeStructure feeSettings')
    .populate('feeStructure.head', 'name type')
    .populate('sections.classTeacher', 'name email')
    .sort({ classNumeric: 1 });
  return successResponse(res, 'Class fee structures retrieved successfully', { classes });
});

export const setClassFeeStructure = asyncHandler(async (req, res) => {
  const { className, academicYear, feeStructure, paymentSchedule, dueDate } = req.body;
  const schoolId = req.schoolId;

  // 1. Calculate Total Annual Fee (Frequency based)
  const totalAnnualFee = feeStructure.reduce((sum, fee) => {
    let annualAmount = Number(fee.amount || 0);
    if (fee.frequency === 'MONTHLY') annualAmount *= 12;
    else if (fee.frequency === 'QUARTERLY') annualAmount *= 4;
    return sum + annualAmount;
  }, 0);

  // 2. Update Class level structure
  await Class.findOneAndUpdate(
    { className, academicYear, schoolId },
    { feeStructure, "feeSettings.totalAnnualFee": totalAnnualFee },
    { new: true }
  );

  // 3. 🔥 Sync to ALL Students in this Class (Across all sections)
  const students = await Student.find({ className, academicYear, schoolId });

  const bulkOps = students.map(student => {
    // 🔥 Aapka generateInstallments yahan use ho raha hai
    const studentInstallments = generateInstallments(feeStructure, academicYear);
    const grandTotal = studentInstallments.reduce((sum, i) => sum + i.amount, 0);

    return {
      updateOne: {
        filter: { student: student._id, academicYear, schoolId },
        update: {
          $set: {
            installments: studentInstallments,
            totalDue: grandTotal,
            totalAmount: grandTotal,
            balancePending: grandTotal, // Initial balance
            status: 'PENDING',
            studentName: student.name,
            studentID: student.studentID,
            className: className,
            section: student.section
          }
        },
        upsert: true
      }
    };
  });

  if (bulkOps.length > 0) {
    await FeePayment.bulkWrite(bulkOps);
  }

  return successResponse(res, 'Roadmap created for all students in this class', { totalAnnualFee });
});

export const assignFeeStructureToStudent = asyncHandler(async (req, res) => {
  const { studentId, academicYear } = req.body;

  const student = await Student.findOne({ _id: studentId, schoolId: req.schoolId }).populate('class');
  if (!student) throw new NotFoundError('Student');

  const classData = await Class.findOne({ _id: student.class, schoolId: req.schoolId }).populate('feeStructure.head');
  if (!classData || !classData.feeStructure.length) {
    throw new ValidationError('No Fee Structure defined for this class');
  }

  const existingFee = await FeePayment.findOne({
    student: student._id,
    academicYear,
    schoolId: req.schoolId
  });
  if (existingFee) {
    throw new ValidationError('Fee structure already assigned for this academic year');
  }

  const installments = generateInstallments(classData.feeStructure, academicYear);
  const grandTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);

  const feePayment = await FeePayment.create({
    schoolId: req.schoolId,
    student: student._id,
    class: student.class,
    academicYear,
    studentName: student.name,
    studentID: student.studentID,
    className: student.className,
    section: student.section,
    installments,
    feeStructure: classData.feeStructure,
    totalAmount: grandTotal,
    totalDue: grandTotal,
    paidAmount: 0,
    pendingAmount: grandTotal,
    balancePending: grandTotal,
    status: 'PENDING'
  });

  return successResponse(res, 'Fee Structure Assigned Successfully', feePayment);
});

export const createBulkFeeStructureFromClass = asyncHandler(async (req, res) => {
  const { classId, academicYear } = req.body;
  if (!classId || !academicYear) {
    throw new ValidationError('Class ID and academic year are required');
  }
  const classData = await Class.findOne({ _id: classId, schoolId: req.schoolId }).populate('feeStructure.head');
  if (!classData) throw new NotFoundError('Class');
  if (!classData.feeStructure || classData.feeStructure.length === 0) {
    throw new ValidationError('Fee structure not set for this class.');
  }
  const students = await Student.find({
    class: classId,
    academicYear,
    status: { $in: ['ENROLLED', 'ACTIVE'] },
    schoolId: req.schoolId
  });
  if (students.length === 0) {
    throw new ValidationError('No enrolled students found for this class and academic year');
  }

  const results = { created: [], skipped: [], failed: [] };
  for (const student of students) {
    try {
      const existingFee = await FeePayment.findOne({ 
        student: student._id, 
        academicYear,
        schoolId: req.schoolId
      });
      if (existingFee) {
        results.skipped.push({ 
          studentID: student.studentID, 
          name: student.name, 
          reason: 'Fee structure already exists' 
        });
        continue;
      }

      let installments = [];
      let grandTotal = 0;

      classData.feeStructure.forEach(rule => {
        if (rule.frequency === 'MONTHLY') {
          const months = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'];
          months.forEach((month, index) => {
            const year = academicYear.split('-')[0];
            const monthNum = (index + 3) % 12 + 1;
            const dueDate = new Date(`${year}-${String(monthNum).padStart(2, '0')}-10`);
            installments.push({
              head: rule.head._id,
              headName: rule.headName,
              name: `${month} - ${rule.headName}`,
              amount: rule.amount,
              dueDate: dueDate,
              paidAmount: 0,
              status: 'PENDING'
            });
            grandTotal += rule.amount;
          });
        } else if (rule.frequency === 'QUARTERLY') {
          const quarters = [
            { name: 'Q1 (APR-JUN)', dueDate: new Date(`${academicYear.split('-')[0]}-04-10`) },
            { name: 'Q2 (JUL-SEP)', dueDate: new Date(`${academicYear.split('-')[0]}-07-10`) },
            { name: 'Q3 (OCT-DEC)', dueDate: new Date(`${academicYear.split('-')[0]}-10-10`) },
            { name: 'Q4 (JAN-MAR)', dueDate: new Date(`${Number(academicYear.split('-')[0]) + 1}-01-10`) }
          ];
          quarters.forEach(quarter => {
            installments.push({
              head: rule.head._id,
              headName: rule.headName,
              name: `${quarter.name} - ${rule.headName}`,
              amount: rule.amount * 3,
              dueDate: quarter.dueDate,
              paidAmount: 0,
              status: 'PENDING'
            });
            grandTotal += rule.amount * 3;
          });
        } else if (rule.frequency === 'YEARLY' || rule.frequency === 'ONE_TIME') {
          const dueDate = new Date(`${academicYear.split('-')[0]}-04-10`);
          installments.push({
            head: rule.head._id,
            headName: rule.headName,
            name: rule.headName,
            amount: rule.amount,
            dueDate: dueDate,
            paidAmount: 0,
            status: 'PENDING'
          });
          grandTotal += rule.amount;
        }
      });

      installments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

      const feePayment = await FeePayment.create({
        schoolId: req.schoolId,
        student: student._id,
        class: student.class,
        academicYear,
        studentName: student.name,
        studentID: student.studentID,
        className: student.className,
        section: student.section,
        installments: installments,
        feeStructure: classData.feeStructure,
        totalAmount: grandTotal,
        totalDue: grandTotal,
        paidAmount: 0,
        pendingAmount: grandTotal,
        balancePending: grandTotal,
        status: 'PENDING'
      });

      results.created.push({ 
        studentID: student.studentID, 
        name: student.name, 
        feePaymentId: feePayment._id 
      });
    } catch (error) {
      results.failed.push({ 
        studentID: student.studentID, 
        name: student.name, 
        error: error.message 
      });
    }
  }

  return successResponse(res, 'Bulk fee structure created successfully', {
    totalStudents: students.length,
    created: results.created.length,
    skipped: results.skipped.length,
    failed: results.failed.length,
    details: results,
  }, 201);
});

// ==========================================
// 4. SMART PAYMENT RECORDING (Auto-Allocation)
// ==========================================

export const recordPayment = asyncHandler(async (req, res) => {
  const { studentId, academicYear, amountPaid, paymentMode, paymentDate, remarks, selectedInstallmentIds } = req.body;

  const fee = await FeePayment.findOne({ student: studentId, academicYear, schoolId: req.schoolId });
  if (!fee) throw new NotFoundError("Fee record not found");

  const amount = Number(amountPaid);
  let remaining = amount;
  const covered = [];

  // --- Logic A: Selective Month Payment ---
  if (selectedInstallmentIds && selectedInstallmentIds.length > 0) {
    for (let id of selectedInstallmentIds) {
      const inst = fee.installments.id(id);
      if (inst && inst.status !== "PAID") {
        const needed = inst.amount - (inst.paidAmount || 0);
        const allocated = Math.min(remaining, needed);
        
        inst.paidAmount += allocated;
        inst.status = inst.paidAmount >= inst.amount ? "PAID" : "PARTIAL";
        
        remaining -= allocated;
        covered.push({ installmentId: inst._id, amount: allocated, name: inst.name });
      }
    }
  } 
  // --- Logic B: Waterfall (Purana Logic) ---
  else {
    fee.installments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    for (let inst of fee.installments) {
      if (remaining <= 0) break;
      if (inst.status === "PAID") continue;

      const needed = inst.amount - (inst.paidAmount || 0);
      const allocated = Math.min(remaining, needed);

      inst.paidAmount += allocated;
      inst.status = inst.paidAmount >= inst.amount ? "PAID" : "PARTIAL";
      
      remaining -= allocated;
      covered.push({ installmentId: inst._id, amount: allocated, name: inst.name });
    }
  }

  // Transaction record karein
  const receiptNumber = `RCP-${Date.now()}`;
  fee.payments.push({
    amount: amount,
    paymentMode,
    paymentDate: new Date(paymentDate),
    receiptNumber,
    remarks: remarks || (selectedInstallmentIds ? "Manual Selection" : "Waterfall Allocation"),
    installmentsCovered: covered
  });

  // Totals update
  fee.totalPaid = (fee.totalPaid || 0) + amount;
  fee.balancePending = Math.max(0, (fee.totalDue || fee.totalAmount) - fee.totalPaid);
  fee.status = fee.balancePending <= 0 ? "PAID" : "PARTIAL";

  await fee.save();
  return successResponse(res, "Payment processed successfully", { feePayment: fee, receiptNumber });
});
// ==========================================
// 5. FEE REPORTS & STATISTICS
// ==========================================
export const getFeeStatistics = asyncHandler(async (req, res) => {
  const { academicYear, month } = req.query; // month e.g., "JANUARY"
  const schoolId = req.schoolId;

  const feePayments = await FeePayment.find({ schoolId, academicYear }).lean();

  let totalExpected = 0;
  let totalCollected = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  const monthPrefix = month && month !== "ALL" ? month.substring(0, 3).toUpperCase() : null;

  feePayments.forEach(fp => {
    if (monthPrefix) {
      // 🎯 MONTHLY LOGIC: Match specific month (e.g., "JAN - tution fee")
      const target = fp.installments.find(inst => 
        inst.name.toUpperCase().startsWith(monthPrefix)
      );

      if (target) {
        totalExpected += target.amount;
        totalCollected += target.paidAmount;
        if (target.status === "PAID") paidCount++; else unpaidCount++;
      }
    } else {
      // 📊 YEARLY LOGIC
      totalExpected += fp.totalDue;
      totalCollected += fp.totalPaid;
      const isActuallyPaid = (fp.totalDue - fp.totalPaid) <= 0;
      if (isActuallyPaid) paidCount++; else unpaidCount++;
    }
  });

  return successResponse(res, 'Stats calculated', {
    totalStudents: feePayments.length,
    totalExpected,
    totalCollected,
    totalPending: totalExpected - totalCollected,
    collectionPercentage: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
    paymentStatus: { paid: paidCount, unpaid: unpaidCount }
  });
});

export const getFeeDefaulters = asyncHandler(async (req, res) => {
  const { academicYear, daysOverdue = 30 } = req.query;
  if (!academicYear) throw new ValidationError('Academic year is required');
  const feePayments = await FeePayment.find({
    schoolId: req.schoolId,
    academicYear,
    'installments': {
      $elemMatch: {
        status: { $in: ['PENDING', 'PARTIAL'] },
        dueDate: { $lt: new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000) }
      }
    }
  })
    .populate('student', 'name studentID className section parentPhone')
    .select('studentName studentID className section balancePending installments')
    .lean();

  const defaulters = feePayments.map(fee => {
    const overdueInstallments = fee.installments.filter(inst => 
      inst.status !== 'PAID' && 
      new Date(inst.dueDate) < new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000)
    );
    const totalOverdue = overdueInstallments.reduce((sum, inst) => sum + (inst.amount - inst.paidAmount), 0);
    return {
      studentId: fee.student?._id || fee.student,
      studentName: fee.studentName,
      studentID: fee.studentID,
      className: fee.className,
      section: fee.section,
      parentPhone: fee.student?.parentPhone,
      totalOverdue,
      overdueInstallments: overdueInstallments.length,
      daysOverdue: Math.max(...overdueInstallments.map(inst => 
        Math.floor((new Date() - new Date(inst.dueDate)) / (1000 * 60 * 60 * 24))
      )) || 0,
      balancePending: fee.balancePending
    };
  });

  defaulters.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return successResponse(res, 'Fee defaulters retrieved', {
    defaulters,
    total: defaulters.length,
    totalOverdue: defaulters.reduce((sum, def) => sum + def.totalOverdue, 0)
  });
});

// ==========================================
// 6. RECEIPT GENERATION (PDF)
// ==========================================

export const downloadReceipt = asyncHandler(async (req, res) => {
  try {
    const { paymentId } = req.params;

    // 1) Get fee payment + student
    const feePayment = await FeePayment.findOne({
      'payments._id': paymentId,
      schoolId: req.schoolId
    }).populate(
      'student',
      'name studentID rollNumber className section fatherName motherName address phone'
    );

    if (!feePayment) return res.status(404).end();

    const payment = feePayment.payments.id(paymentId);
    if (!payment) return res.status(404).end();

    // 1. Determine the context of the receipt
    const isMonthlyPayment = payment.installmentsCovered && payment.installmentsCovered.length > 0;
    
    // 2. Logic for the Red/Green Status Badge on the PDF
    // If it's a monthly payment and it cleared at least one month, show 'PAID' or 'MONTHLY CLEAR'
    let displayStatus = feePayment.status; 
    if (isMonthlyPayment) {
      const allCoveredPaid = payment.installmentsCovered.every(ic => {
          const inst = feePayment.installments.id(ic.installmentId);
          return inst && inst.status === "PAID";
      });
      displayStatus = allCoveredPaid ? "MONTHLY PAID" : "PARTIAL";
    }

    // 2) Get school info
    const school = await School.findById(req.schoolId).lean();
    const schoolName = school?.schoolName || 'Your School Name';
    const schoolPhone = school?.phone || '';
    const schoolEmail = school?.adminEmail || '';
    const schoolAddressLine = [
      school?.address?.city,
      school?.address?.state,
      school?.address?.country
    ]
      .filter(Boolean)
      .join(', ');

    // 3) Safe numbers to avoid NaN
    const totalAmount = Number(feePayment.totalAmount || feePayment.totalDue || 0);
    const totalPaid = Number(feePayment.totalPaid || feePayment.paidAmount || 0);
    const pending = Number(
      feePayment.balancePending ?? 
      feePayment.pendingAmount ?? 
      totalAmount - totalPaid
    ) || 0;

    // Helper function - NO CURRENCY SYMBOL (just number)
    const formatAmount = (val) => {
      const num = Number(val || 0);
      return num.toLocaleString('en-IN', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 2 
      });
    };

    // Helper to draw currency + amount separately
    const drawAmount = (doc, amount, xPos, yPos, fontSize, color) => {
      const formattedAmount = formatAmount(amount);
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(color);
      doc.text('Rs. ', xPos, yPos, { continued: true });
      doc.text(formattedAmount);
    };

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Fee_Receipt_${payment.receiptNumber}.pdf"`,
      'Cache-Control': 'no-cache'
    });

    const doc = new PDFDocument({ compress: false, size: 'A4', margin: 40 });
    doc.pipe(res);

    const pageWidth = 595;
    const marginLeft = 40;
    const marginRight = 40;
    const contentWidth = pageWidth - marginLeft - marginRight;

    // ---------- SCHOOL HEADER ----------
    doc.rect(marginLeft, 30, contentWidth, 80).fill('#1e3a8a');

    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('white')
      .text(schoolName.toUpperCase(), marginLeft + 20, 45, {
        width: contentWidth - 40
      });

    doc
      .fontSize(10)
      .fillColor('#e2e8f0')
      .text(
        schoolAddressLine || 'School Address',
        marginLeft + 20,
        75,
        { width: contentWidth - 40 }
      )
      .text(
        [schoolPhone && `Phone: ${schoolPhone}`, schoolEmail && `Email: ${schoolEmail}`]
          .filter(Boolean)
          .join(' | ') || '',
        marginLeft + 20,
        90,
        { width: contentWidth - 40 }
      );

    // ---------- TITLE ----------
    let yPos = 130;
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#1e40af')
      .text('OFFICIAL FEE RECEIPT', marginLeft, yPos, {
        align: 'center',
        width: contentWidth
      });
    doc
      .moveTo(marginLeft + 100, yPos + 25)
      .lineTo(marginLeft + contentWidth - 100, yPos + 25)
      .stroke('#1e40af');

    // ---------- RECEIPT INFO ----------
    yPos += 45;
    const boxHeight = 50;
    doc.rect(marginLeft, yPos, contentWidth, boxHeight).stroke('#cbd5e1').lineWidth(1);

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('Receipt Number:', marginLeft + 15, yPos + 10);
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text(String(payment.receiptNumber || 'N/A'), marginLeft + 15, yPos + 25);

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('Receipt Date:', marginLeft + 180, yPos + 10);
    doc
      .fontSize(12)
      .fillColor('#0f172a')
      .text(
        new Date(payment.paymentDate || Date.now()).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        marginLeft + 180,
        yPos + 25
      );

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1f2937')
      .text('Academic Year:', marginLeft + 350, yPos + 10);
    doc
      .fontSize(12)
      .fillColor('#0f172a')
      .text(String(feePayment.academicYear || 'N/A'), marginLeft + 350, yPos + 25);

    yPos += boxHeight + 15;

    // ---------- STUDENT INFO ----------
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text('STUDENT INFORMATION', marginLeft, yPos);
    yPos += 18;

    doc.rect(marginLeft, yPos, contentWidth, 65).stroke('#cbd5e1').lineWidth(1.5);
    const infoYPos = yPos + 10;

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#475569')
      .text('Name:', marginLeft + 15, infoYPos);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#0f172a')
      .text(String(feePayment.studentName || '').toUpperCase(), marginLeft + 80, infoYPos, {
        width: 200
      });

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#475569')
      .text('Student ID:', marginLeft + 15, infoYPos + 18);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#0f172a')
      .text(String(feePayment.studentID || ''), marginLeft + 80, infoYPos + 18);

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#475569')
      .text('Class:', marginLeft + 15, infoYPos + 36);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#0f172a')
      .text(
        `${String(feePayment.className || '')}${
          feePayment.section ? ` - Section ${feePayment.section}` : ''
        }`,
        marginLeft + 80,
        infoYPos + 36
      );

    if (feePayment.student?.rollNumber) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#475569')
        .text('Roll No:', marginLeft + 320, infoYPos);
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#0f172a')
        .text(String(feePayment.student.rollNumber), marginLeft + 390, infoYPos);
    }

    yPos += 90;

    // ---------- PAYMENT DETAILS ----------
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text('PAYMENT DETAILS', marginLeft, yPos);
    doc.moveDown(0.5);

    const payBoxTop = doc.y;
    const payBoxHeight = 80;

    doc
      .rect(marginLeft, payBoxTop, contentWidth, payBoxHeight)
      .fill('#f0fdf4')
      .stroke('#22c55e')
      .lineWidth(2);

    const payInnerTop = payBoxTop + 10;
    doc.rect(marginLeft + 15, payInnerTop - 2, 110, 25).fill('#3b82f6').stroke();
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('white')
      .text(
        String(payment.paymentMode || 'CASH').toUpperCase(),
        marginLeft + 15,
        payInnerTop + 2,
        { width: 110, align: 'center' }
      );

    // ✅ FIX: Draw currency and amount separately
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#059669')
      .text('Rs. ', marginLeft + 140, payInnerTop, { continued: true })
      .fontSize(26)
      .text(formatAmount(payment.amount));

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#64748b')
      .text('Amount Paid', marginLeft + 140, payInnerTop + 30);

    let payDetailY = payInnerTop + 48;
    doc.fontSize(10).font('Helvetica').fillColor('#475569');
    if (payment.remarks) {
      doc.text(`Remarks: ${payment.remarks}`, marginLeft + 15, payDetailY);
      payDetailY += 12;
    }

    yPos = payBoxTop + payBoxHeight + 20;
    doc.y = yPos;

    // ---------- FEE SUMMARY ----------
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text('FEE SUMMARY', marginLeft, yPos);
    doc.moveDown(0.5);

    const sumBoxTop = doc.y;
    const sumBoxHeight = 80;

    doc
      .rect(marginLeft, sumBoxTop, contentWidth, sumBoxHeight)
      .fill('#fef3c7')
      .stroke('#f59e0b')
      .lineWidth(1.5);

    const col1X = marginLeft + 20;
    const col2X = marginLeft + 260;
    const sumInnerTop = sumBoxTop + 12;

    // ✅ FIX: Total Fee
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#92400e')
      .text('Total Fee:', col1X, sumInnerTop);
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Rs. ', col1X, sumInnerTop + 16, { continued: true })
      .font('Helvetica')
      .text(formatAmount(totalAmount));

    // ✅ FIX: Total Paid
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#92400e')
      .text('Total Paid:', col1X, sumInnerTop + 36);
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Rs. ', col1X, sumInnerTop + 52, { continued: true })
      .font('Helvetica')
      .text(formatAmount(totalPaid));

    // ✅ FIX: Balance Due
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#92400e')
      .text('Balance Due:', col2X, sumInnerTop);
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(pending > 0 ? '#dc2626' : '#059669')
      .text('Rs. ', col2X, sumInnerTop + 16, { continued: true })
      .fontSize(14)
      .text(formatAmount(pending));

    const statusColor = displayStatus.includes('PAID') ? '#059669' : '#dc2626';

    const badgeY = sumInnerTop + 46;
    doc.rect(col2X, badgeY, 100, 22).fill(statusColor).stroke();
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('white')
      .text(
        String(displayStatus || 'PAID').replace('_', ' '),
        col2X,
        badgeY + 3,
        { width: 100, align: 'center' }
      );

    yPos = sumBoxTop + sumBoxHeight + 25;
    doc.y = yPos;

    // ---------- INSTALLMENT BREAKDOWN ----------
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b').text('INSTALLMENT & PERIOD BREAKDOWN', marginLeft, yPos);
    yPos += 20;

    if (isMonthlyPayment) {
      payment.installmentsCovered.forEach(ic => {
        // Find the name from the actual installments array
        const originalInst = feePayment.installments.find(i => i._id.toString() === ic.installmentId.toString());
        const instName = originalInst ? originalInst.name : "Fee Installment";

        doc.fontSize(10).font('Helvetica').fillColor('#475569').text(instName, marginLeft + 15, yPos);
        doc.text(`Rs. ${formatAmount(ic.amount)}`, marginLeft + 350, yPos, { align: 'right', width: 100 });
        yPos += 18;
      });
    } else {
      doc.fontSize(10).text("General Fee Credit", marginLeft + 15, yPos);
      yPos += 18;
    }
    
    doc.y = yPos;

    // ---------- AUTHORIZED SIGNATURE ----------
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
      .text('AUTHORIZED SIGNATURE', marginLeft, doc.y);
    doc.moveDown(1);
    const sigLineY = doc.y + 20;
    doc.moveTo(marginLeft + 15, sigLineY)
      .lineTo(marginLeft + 150, sigLineY)
      .stroke('#374151')
      .lineWidth(1.2);
    doc.fontSize(10).font('Helvetica').fillColor('#64748b')
      .text('Received By', marginLeft + 15, sigLineY + 4);
    const dateX = marginLeft + 260;
    doc.moveTo(dateX, sigLineY)
      .lineTo(dateX + 135, sigLineY)
      .stroke('#374151')
      .lineWidth(1.2);
    doc.fontSize(10).font('Helvetica').fillColor('#64748b')
      .text('Date', dateX, sigLineY + 4);
    doc.y = sigLineY + 40;

    // ---------- FOOTER ----------
    doc.rect(marginLeft, doc.y, contentWidth, 50).fill('#f8fafc').stroke('#e2e8f0').lineWidth(1);
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      .text('This is a computer-generated official receipt. No signature required for validity.', 
            marginLeft + 15, doc.y + 10, { align: 'center', width: contentWidth - 30 })
      .text(`Generated on: ${new Date().toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata', 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      })}`, marginLeft + 15, doc.y + 28, { align: 'center', width: contentWidth - 30 });
    doc.fontSize(7).fillColor('#94a3b8')
      .text('For any queries, contact the school office', marginLeft + 15, doc.y + 38, 
            { align: 'center', width: contentWidth - 30 });

    doc.end();
  } catch (error) {
    console.error('PDF ERROR:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF generation failed' });
    } else {
      res.end();
    }
  }
});

// ==========================================
// 7. HELPER & EXPORTS
// ==========================================

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export const getAllPayments = asyncHandler(async (req, res) => {
  const { academicYear, status, className } = req.query;
  const schoolId = req.schoolId;

  const filter = { schoolId };

  if (academicYear) filter.academicYear = academicYear;
  if (status) filter.status = status;
  if (className) filter.className = className;

  // Date filter hata do abhi
  // if (startDate || endDate) { ... }

  const payments = await FeePayment.find(filter)
    .lean();

  const formattedPayments = [];

  payments.forEach(fp => {
    const pays = Array.isArray(fp.payments) ? fp.payments : [];
    pays.forEach(pmt => {
      formattedPayments.push({
        _id: pmt._id,
        feePaymentId: fp._id,
        receiptNumber: pmt.receiptNumber,
        student: {
          name: fp.studentName,
          studentID: fp.studentID
        },
        className: fp.className,
        section: fp.section,
        amountPaid: pmt.amount,
        paymentMethod: pmt.paymentMode,
        paymentDate: pmt.paymentDate,
        status: fp.status,
        remarks: pmt.remarks
      });
    });
  });

  return successResponse(res, 'All payments fetched', { payments: formattedPayments });
});

export default {
  createFeeHead,
  getFeeHeads,
  updateFeeHead,
  deleteFeeHead,
  getClassFeeStructures,
  setClassFeeStructure,
  assignFeeStructureToStudent,
  createBulkFeeStructureFromClass,
  recordPayment,
  getFeeStatistics,
  getFeeDefaulters,
  downloadReceipt,
  getStudentsWithFees,
  getAllPayments,
};

