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

export const getStudentsWithFees = asyncHandler(async (req, res) => {
  const { academicYear, search, status, page = 1, limit = 50 } = req.query;
  const schoolId = req.schoolId;

  if (!academicYear) {
    throw new ValidationError("Academic year is required");
  }

  let filter = { schoolId, academicYear, role: 'student' };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { studentID: { $regex: search, $options: 'i' } },
      { className: { $regex: search, $options: 'i' } },
    ];
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    lean: true
  };

  const students = await Student.paginate(filter, options);

  const studentsWithFees = [];

  for (const student of students.docs) {
    const feePayment = await FeePayment.findOne({
      student: student._id,
      academicYear,
      schoolId
    }).lean();

    // 🟢 CASE 1: FeePayment exists
    if (feePayment) {
      // ✅ STATUS FILTERING
      if (status === "paid" && feePayment.status !== "PAID") continue;
      if (status === "unpaid" && feePayment.status === "PAID") continue;

      studentsWithFees.push({
        ...student,
        feeDetails: {
          totalFee: feePayment.totalDue ?? feePayment.totalAmount ?? 0,
          paidAmount: feePayment.totalPaid ?? feePayment.paidAmount ?? 0,
          pendingAmount: feePayment.balancePending ?? 0,
          status: feePayment.status,
          classHasFeeStructure: true,
          feePaymentId: feePayment._id
        }
      });
    }
    // 🟢 CASE 2: FeePayment DOES NOT exist (0 payment student)
    else {
      // unpaid filter me hi dikhana hai
      if (status === "paid") continue;

      studentsWithFees.push({
        ...student,
        feeDetails: {
          totalFee: 0,
          paidAmount: 0,
          pendingAmount: 0,
          status: "NOT_SET",
          classHasFeeStructure: false,
          feePaymentId: null
        }
      });
    }
  }

  return successResponse(res, "Students fetched successfully", {
    students: studentsWithFees,
    pagination: {
      current: students.page,
      pages: students.totalPages,
      total: students.totalDocs
    }
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

// export const setClassFeeStructure = asyncHandler(async (req, res) => {
//   const {
//     className,
//     academicYear,
//     feeStructure,
//     paymentSchedule,
//     dueDate,
//     lateFeeAmount,
//     lateFeeApplicableAfter
//   } = req.body;

//   if (!className || !academicYear) {
//     throw new ValidationError('Class name and academic year are required');
//   }

//   if (!feeStructure || !Array.isArray(feeStructure) || feeStructure.length === 0) {
//     throw new ValidationError('Fee structure array is required');
//   }

//   feeStructure.forEach((fee, idx) => {
//     if (!fee.headName) {
//       throw new ValidationError(`Fee headName is required at row ${idx + 1}`);
//     }
//     if (!fee.amount || fee.amount < 0) {
//       throw new ValidationError(`Valid amount is required at row ${idx + 1}`);
//     }
//     if (!fee.frequency) {
//       throw new ValidationError(`Frequency is required at row ${idx + 1}`);
//     }
//   });

//   const classData = await Class.findOne({ className, academicYear, schoolId: req.schoolId });
//   if (!classData) throw new NotFoundError('Class');

//   const totalAnnualFee = feeStructure.reduce((sum, fee) => {
//     let annualAmount = fee.amount || 0;
//     if (fee.frequency === 'MONTHLY') annualAmount *= 12;
//     else if (fee.frequency === 'QUARTERLY') annualAmount *= 4;
//     else if (fee.frequency === 'HALF_YEARLY') annualAmount *= 2;
//     return sum + annualAmount;
//   }, 0);

//   const formattedFeeStructure = feeStructure.map(fee => ({
//     head: fee.head || null,
//     headName: fee.headName,
//     amount: fee.amount || 0,
//     frequency: fee.frequency || 'YEARLY',
//     dueMonth: fee.dueMonth || null,
//     lateFee: fee.lateFee || 0
//   }));

//   classData.feeStructure = formattedFeeStructure;
//   classData.feeSettings = {
//     paymentSchedule: paymentSchedule || 'YEARLY',
//     dueDate: dueDate || null,
//     lateFeeAmount: Number(lateFeeAmount || 0),
//     lateFeeApplicableAfter: lateFeeApplicableAfter || null,
//     totalAnnualFee
//   };

//   await classData.save();

//   // Auto-assign fee structure to all students in this class
//   const students = await Student.find({
//     schoolId: req.schoolId,
//     class: classData._id,
//     academicYear
//   });

//   for (const student of students) {
//     const existingFee = await FeePayment.findOne({
//       student: student._id,
//       academicYear,
//       schoolId: req.schoolId
//     });
//     if (existingFee) continue; // Skip if already exists

//     const installments = generateInstallments(formattedFeeStructure, academicYear);
//     const grandTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);

//     await FeePayment.create({
//       schoolId: req.schoolId,
//       student: student._id,
//       class: classData._id,
//       academicYear,
//       studentName: student.name,
//       studentID: student.studentID,
//       className: classData.className,
//       section: student.section,
//       installments,
//       feeStructure: formattedFeeStructure,
//       totalAmount: grandTotal,
//       totalDue: grandTotal,
//       paidAmount: 0,
//       pendingAmount: grandTotal,
//       balancePending: grandTotal,
//       status: 'PENDING'
//     });
//   }

//   return successResponse(res, 'Fee structure set successfully for class and assigned to all students', {
//     className: classData.className,
//     academicYear: classData.academicYear,
//     feeStructure: formattedFeeStructure,
//     totalAnnualFee,
//     paymentSchedule,
//     dueDate
//   });
// });

// ==========================================
// 3. SMART FEE ASSIGNMENT WITH INSTALLMENTS
// ==========================================



export const setClassFeeStructure = asyncHandler(async (req, res) => {
  const {
    className,
    academicYear,
    feeStructure,
    paymentSchedule,
    dueDate,
    lateFeeAmount,
    lateFeeApplicableAfter
  } = req.body;

  // ===== Validation =====
  if (!className || !academicYear) {
    throw new ValidationError('Class name and academic year are required');
  }

  if (!feeStructure || !Array.isArray(feeStructure) || feeStructure.length === 0) {
    throw new ValidationError('Fee structure array is required');
  }

  feeStructure.forEach((fee, idx) => {
    if (!fee.headName) throw new ValidationError(`Fee headName is required at row ${idx + 1}`);
    if (!fee.amount || fee.amount < 0) throw new ValidationError(`Valid amount is required at row ${idx + 1}`);
    if (!fee.frequency) throw new ValidationError(`Frequency is required at row ${idx + 1}`);
  });

  // ===== Get class =====
  const classData = await Class.findOne({ className, academicYear, schoolId: req.schoolId });
  if (!classData) throw new NotFoundError('Class');

  // ===== Calculate total annual fee =====
  const totalAnnualFee = feeStructure.reduce((sum, fee) => {
    let annualAmount = fee.amount || 0;
    if (fee.frequency === 'MONTHLY') annualAmount *= 12;
    else if (fee.frequency === 'QUARTERLY') annualAmount *= 4;
    else if (fee.frequency === 'HALF_YEARLY') annualAmount *= 2;
    return sum + annualAmount;
  }, 0);

  // ===== Format fee structure =====
  const formattedFeeStructure = feeStructure.map(fee => ({
    head: fee.head || null,
    headName: fee.headName,
    amount: fee.amount || 0,
    frequency: fee.frequency || 'YEARLY',
    dueMonth: fee.dueMonth || null,
    lateFee: fee.lateFee || 0
  }));

  // ===== Update class fee settings =====
  classData.feeStructure = formattedFeeStructure;
  classData.feeSettings = {
    paymentSchedule: paymentSchedule || 'YEARLY',
    dueDate: dueDate || null,
    lateFeeAmount: Number(lateFeeAmount || 0),
    lateFeeApplicableAfter: lateFeeApplicableAfter || null,
    totalAnnualFee
  };

  await classData.save();

  // ===== Assign fee to students =====
  const students = await Student.find({
    schoolId: req.schoolId,
    class: classData._id,
    academicYear
  });

  for (const student of students) {
    // Generate installments & total for all studentsf
    const installments = generateInstallments(formattedFeeStructure, academicYear);

    // 🔥 MONTHLY → YEARLY TOTAL AUTO CALCULATION
const grandTotal = installments.reduce(
  (sum, inst) => sum + Number(inst.amount || 0),
  0
);

    // const grandTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);

    const existingFee = await FeePayment.findOne({
      student: student._id,
      academicYear,
      schoolId: req.schoolId
    });

    if (existingFee) {
      const alreadyPaid = existingFee.paidAmount || existingFee.totalPaid || 0;
      const newPending = Math.max(grandTotal - alreadyPaid, 0);

      existingFee.feeStructure = formattedFeeStructure;
      existingFee.installments = installments;
      existingFee.totalAmount = grandTotal;
      existingFee.totalDue = grandTotal;
      existingFee.pendingAmount = newPending;
      existingFee.balancePending = newPending;

      if (newPending === 0) existingFee.status = 'PAID';
      else if (alreadyPaid > 0) existingFee.status = 'PARTIAL';
      else existingFee.status = 'PENDING';

      await existingFee.save();
      continue;
    }

    // If no existing fee, create new fee record
    await FeePayment.create({
      schoolId: req.schoolId,
      student: student._id,
      class: classData._id,
      academicYear,
      studentName: student.name,
      studentID: student.studentID,
      className: classData.className,
      section: student.section,
      installments,
      feeStructure: formattedFeeStructure,
      totalAmount: grandTotal,
      totalDue: grandTotal,
      paidAmount: 0,
      pendingAmount: grandTotal,
      balancePending: grandTotal,
      status: 'PENDING'
    });
  }

  return successResponse(res, 'Fee structure set successfully for class and assigned to all students', {
    className: classData.className,
    academicYear: classData.academicYear,
    feeStructure: formattedFeeStructure,
    totalAnnualFee,
    paymentSchedule,
    dueDate
  });
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
  const {
    feePaymentId,
    installmentId,
    amountPaid,
    paymentMode,
    receiptNumber,
    paymentDate,
  } = req.body;

  if (!feePaymentId) {
    throw new Error("feePaymentId is required");
  }

  const fee = await FeePayment.findById(feePaymentId);
  if (!fee) throw new Error("Fee record not found");

  const paidAmt = Number(amountPaid);
  if (isNaN(paidAmt) || paidAmt <= 0) {
    throw new Error("Invalid amountPaid");
  }

  let installment;

  // ===== Handle first payment or missing installmentId =====
  if (!installmentId) {
    // No installment exists → create first installment
    installment = {
      _id: new mongoose.Types.ObjectId(),
      name: `First Payment`,
      headName: "Tuition", // You can customize or pass from frontend
      amount: paidAmt,
      paidAmount: 0,
      dueDate: new Date(),
      status: "PENDING",
    };
    fee.installments.push(installment);
  } else {
    // Existing installment
    installment = fee.installments.find(
      (inst) => inst._id.toString() === installmentId
    );
    if (!installment) {
      throw new Error("Installment not found");
    }
  }

  // ===== UPDATE INSTALLMENT =====
  installment.paidAmount += paidAmt;
  if (installment.paidAmount >= installment.amount) {
    installment.status = "PAID";
  } else {
    installment.status = "PARTIAL";
  }

  // ===== PUSH PAYMENT =====
  fee.payments.push({
    receiptNumber,
    paymentMode,
    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
    amount: paidAmt,
    installmentsCovered: [
      {
        installmentId: installment._id,
        amount: paidAmt,
      },
    ],
  });

  // ===== UPDATE TOTALS =====
  fee.totalPaid = (fee.totalPaid || 0) + paidAmt;
  fee.balancePending = (fee.totalDue || fee.totalAmount || 0) - fee.totalPaid;

  fee.status =
    fee.balancePending <= 0
      ? "PAID"
      : fee.totalPaid > 0
      ? "PARTIAL"
      : "PENDING";

  await fee.save();

  return res.status(200).json({
    success: true,
    message: "Payment recorded successfully",
    paidAmount: fee.totalPaid,
    pendingAmount: fee.balancePending,
    status: fee.status,
    installmentId: installment._id, // useful for frontend
  });
});

// export const recordPayment = asyncHandler(async (req, res) => {
//   const { 
//     studentId, 
//     feePaymentId, 
//     amountPaid, 
//     paymentMethod, 
//     transactionId, 
//     chequeNumber, 
//     bankName, 
//     upiId, 
//     paymentDate, 
//     remarks, 
//     academicYear 
//   } = req.body;

//   if (!studentId || !amountPaid || !paymentMethod || !paymentDate || !academicYear) {
//     throw new ValidationError('Required fields missing');
//   }

//   const amount = parseFloat(amountPaid);
//   if (isNaN(amount) || amount <= 0) {
//     throw new ValidationError('Amount must be a valid number greater than 0');
//   }

//   let paymentDateObj = new Date(paymentDate);
//   if (isNaN(paymentDateObj.getTime())) {
//     paymentDateObj = new Date(paymentDate + 'T00:00:00.000Z');
//   }
//   if (isNaN(paymentDateObj.getTime())) {
//     throw new ValidationError('Invalid paymentDate format, expected YYYY-MM-DD');
//   }

//   let feePayment;
//   if (feePaymentId) {
//     feePayment = await FeePayment.findOne({ _id: feePaymentId, schoolId: req.schoolId });
//   } else {
//     feePayment = await FeePayment.findOne({ student: studentId, academicYear, schoolId: req.schoolId });
//   }

//   if (!feePayment) {
//     const student = await Student.findOne({ _id: studentId, schoolId: req.schoolId }).lean();
//     if (!student) throw new NotFoundError('Student not found');
//     const classData = await Class.findOne({ _id: student.class, academicYear, schoolId: req.schoolId }).populate('feeStructure.head').lean();
//     if (!classData?.feeStructure || !classData.feeStructure.length) {
//       throw new ValidationError('Fee structure not set for this student\'s class');
//     }

//     let installments = [];
//     let grandTotal = 0;

//     classData.feeStructure.forEach(rule => {
//       if (rule.frequency === 'MONTHLY') {
//         const months = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'];
//         months.forEach((month, index) => {
//           const year = academicYear.split('-')[0];
//           const monthNum = (index + 3) % 12 + 1;
//           const dueDate = new Date(`${year}-${String(monthNum).padStart(2, '0')}-10`);
//           installments.push({
//             head: rule.head._id,
//             headName: rule.headName,
//             name: `${month} - ${rule.headName}`,
//             amount: rule.amount,
//             dueDate: dueDate,
//             paidAmount: 0,
//             status: 'PENDING'
//           });
//           grandTotal += rule.amount;
//         });
//       } else if (rule.frequency === 'QUARTERLY') {
//         const quarters = [
//           { name: 'Q1 (APR-JUN)', dueDate: new Date(`${academicYear.split('-')[0]}-04-10`) },
//           { name: 'Q2 (JUL-SEP)', dueDate: new Date(`${academicYear.split('-')[0]}-07-10`) },
//           { name: 'Q3 (OCT-DEC)', dueDate: new Date(`${academicYear.split('-')[0]}-10-10`) },
//           { name: 'Q4 (JAN-MAR)', dueDate: new Date(`${Number(academicYear.split('-')[0]) + 1}-01-10`) }
//         ];
//         quarters.forEach(quarter => {
//           installments.push({
//             head: rule.head._id,
//             headName: rule.headName,
//             name: `${quarter.name} - ${rule.headName}`,
//             amount: rule.amount * 3,
//             dueDate: quarter.dueDate,
//             paidAmount: 0,
//             status: 'PENDING'
//           });
//           grandTotal += rule.amount * 3;
//         });
//       } else if (rule.frequency === 'YEARLY' || rule.frequency === 'ONE_TIME') {
//         const dueDate = new Date(`${academicYear.split('-')[0]}-04-10`);
//         installments.push({
//           head: rule.head._id,
//           headName: rule.headName,
//           name: rule.headName,
//           amount: rule.amount,
//           dueDate: dueDate,
//           paidAmount: 0,
//           status: 'PENDING'
//         });
//         grandTotal += rule.amount;
//       }
//     });

//     installments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

//     feePayment = new FeePayment({
//       schoolId: req.schoolId,
//       student: student._id,
//       studentName: student.name,
//       studentID: student.studentID,
//       class: student.class,
//       className: student.className,
//       section: student.section,
//       academicYear,
//       installments: installments,
//       feeStructure: classData.feeStructure,
//       totalAmount: grandTotal,
//       totalDue: grandTotal,
//       paidAmount: 0,
//       pendingAmount: grandTotal,
//       balancePending: grandTotal,
//       status: 'PENDING'
//     });
//   }

//   if (amount > feePayment.balancePending) {
//     throw new ValidationError(`Payment amount (₹${amount}) exceeds pending amount (₹${feePayment.balancePending})`);
//   }

//   let remainingPayment = amount;
//   let coveredInstallments = [];

//   feePayment.installments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

//   for (let inst of feePayment.installments) {
//     if (remainingPayment <= 0) break;
//     if (inst.status === 'PAID') continue;
//     const pendingForThis = inst.amount - inst.paidAmount;
//     let allocated = 0;
//     if (remainingPayment >= pendingForThis) {
//       allocated = pendingForThis;
//       inst.paidAmount += allocated;
//       inst.status = 'PAID';
//       inst.paymentDate = paymentDateObj;
//     } else {
//       allocated = remainingPayment;
//       inst.paidAmount += allocated;
//       inst.status = 'PARTIAL';
//       inst.paymentDate = paymentDateObj;
//     }
//     remainingPayment -= allocated;
//     coveredInstallments.push({
//       installmentId: inst._id,
//       installmentName: inst.name,
//       amount: allocated
//     });
//   }

//   const year = new Date().getFullYear().toString().slice(-2);
//   const receiptCount = await FeePayment.countDocuments({ 
//     schoolId: req.schoolId,
//     'payments.receiptNumber': { $regex: `^RCP${year}` }
//   });
//   const receiptNumber = `RCP${year}${(receiptCount + 1).toString().padStart(5, '0')}`;

//   // const paymentRecord = {
//   //   amount: amount,
//   //   paymentDate: paymentDateObj,
//   //   paymentMode: paymentMethod,
//   //   receiptNumber,
//   //   receivedBy: req.user.id,
//   //   remarks: remarks || '',
//   //   transactionId: transactionId || '',
//   //   chequeNumber: chequeNumber || '',
//   //   bankName: bankName || '',
//   //   upiId: upiId || '',
//   //   installmentsCovered: coveredInstallments
//   // };

// const paymentRecord = asyncHandler(async (req, res) => {
//     const { feeId, installmentId, amount } = req.body;

// const fee = await FeePayment.findById(feeId);
// if (!fee) throw new Error("Fee record not found");

// // 🔥 STEP 1: installment find karo
// const installment = fee.installments.find(
//   i => i._id.toString() === installmentId
// );

// if (!installment) throw new Error("Installment not found");

// // 🔥 STEP 2: installment payment update
// installment.paidAmount += Number(amount);

// if (installment.paidAmount >= installment.amount) {
//   installment.status = "PAID";
// } else {
//   installment.status = "PARTIAL";
// }

// // 🔥 STEP 3: TOTAL update
// fee.paidAmount = (fee.paidAmount || 0) + Number(amount);
// fee.pendingAmount = fee.totalAmount - fee.paidAmount;
// fee.balancePending = fee.pendingAmount;

// // 🔥 STEP 4: overall status
// fee.status =
//   fee.pendingAmount === 0
//     ? "PAID"
//     : fee.paidAmount > 0
//     ? "PARTIAL"
//     : "PENDING";

// await fee.save();

// return res.json({
//   success: true,
//   message: "Payment recorded successfully",
//   paidAmount: fee.paidAmount,
//   pendingAmount: fee.pendingAmount
// });

//   })


//   // Safeguard: payments array undefined ho toh []
//   if (!feePayment.payments) feePayment.payments = [];
//   feePayment.payments.push(paymentRecord);
//   feePayment.totalPaid = (feePayment.totalPaid || 0) + amount;
//   feePayment.paidAmount += amount;
//   feePayment.balancePending -= amount;
//   feePayment.pendingAmount = feePayment.balancePending;

//   if (feePayment.balancePending <= 0) {
//     feePayment.status = 'PAID';
//     feePayment.balancePending = 0;
//     feePayment.pendingAmount = 0;
//   } else if (feePayment.paidAmount > 0) {
//     feePayment.status = 'PARTIALLY_PAID';
//   }

//   const hasOverdueInstallment = feePayment.installments.some(inst => 
//     inst.status !== 'PAID' && new Date(inst.dueDate) < new Date()
//   );
//   if (hasOverdueInstallment && feePayment.balancePending > 0) {
//     feePayment.status = 'OVERDUE';
//   }

//   await feePayment.save();
//   await feePayment.populate('payments.receivedBy', 'name email');
//   await feePayment.populate('student', 'name studentID className section');
//   await feePayment.populate('installments.head', 'name type');

//   return successResponse(res, 'Payment Recorded Successfully', { 
//     feePayment,
//     receiptNumber,
//     paymentRecord,
//     balancePending: feePayment.balancePending,
//     coveredInstallments
//   });
// });

// ==========================================
// 5. STATISTICS & REPORTS
// ==========================================

// export const getFeeStatistics = asyncHandler(async (req, res) => {
//   const { academicYear } = req.query;

//   if (!academicYear) {
//     return successResponse(res, 'Statistics calculated', {
//       academicYear: getCurrentAcademicYear(),
//       totalStudents: 0,
//       totalExpected: 0,
//       totalCollected: 0,
//       totalPending: 0,
//       collectionPercentage: 0,
//       paymentStatus: {  completed: 0, partial: 0, pending: 0, overdue: 0 },
//       installmentStats: { total: 0, paid: 0, partial: 0, pending: 0, overdue: 0 }
//     });
//   }

//   // 1) Students count
//   const totalStudents = await Student.countDocuments({
//     schoolId: req.schoolId,
//     academicYear,
//     status: { $in: ['ENROLLED', 'ACTIVE'] }
//   });

//   // 2) Saare feePayments simple find se lao
//   const students = await Student.find({
//   schoolId: req.schoolId,
//   academicYear,
//   status: { $in: ['ENROLLED', 'ACTIVE'] }
// }).select('_id').lean();

// const feePayments = await FeePayment.find({
//   schoolId: req.schoolId,
//   academicYear
// }).lean();

// // ===== PAID / UNPAID STUDENT COUNT =====
// const paidStudentIds = new Set(
//   feePayments
//     .filter(f => f.status === 'PAID')
//     .map(f => String(f.student))
// );

// const unpaidStudentIds = new Set();

// students.forEach(s => {
//   if (!paidStudentIds.has(String(s._id))) {
//     unpaidStudentIds.add(String(s._id));
//   }
// });


//   let totalExpected = 0;
//   let totalCollected = 0;
//   let totalPending = 0;

//   let completed = paidStudentIds.size;
// let pending = unpaidStudentIds.size;
// let partial = feePayments.filter(f => f.status === 'PARTIALLY_PAID').length;
// let overdue = feePayments.filter(f => f.status === 'OVERDUE').length;


//   let totalInstallments = 0;
//   let paidInstallments = 0;
//   let partialInstallments = 0;
//   let pendingInstallments = 0;
//   let overdueInstallments = 0;

//   for (const fee of feePayments) {
//     // yahan dono naming variants support kar rahe hain
//     totalExpected += fee.totalDue ?? fee.totalAmount ?? 0;
//     totalCollected += fee.totalPaid ?? fee.paidAmount ?? 0;
//     totalPending += fee.balancePending ?? 0;


//     const installments = fee.installments || [];
//     totalInstallments += installments.length;

//     for (const inst of installments) {
//       if (inst.status === 'PAID') paidInstallments++;
//       else if (inst.status === 'PARTIAL') partialInstallments++;
//       else if (inst.status === 'PENDING') pendingInstallments++;
//       else if (inst.status === 'OVERDUE') overdueInstallments++;
//     }
//   }

//   const collectionPercentage =
//     totalStudents > 0 && totalExpected > 0
//       ? Math.round((totalCollected / totalExpected) * 100)
//       : 0;

//   // return successResponse(res, 'Fee statistics retrieved successfully', {
//   //   academicYear,
//   //   totalStudents,
//   //   totalExpected,
//   //   totalCollected,
//   //   totalPending,
//   //   collectionPercentage: Math.max(0, Math.min(100, collectionPercentage)),
//   //   paymentStatus: {
//   //     completed,
//   //     partial,
//   //     pending,
//   //     overdue
//   //   },
//   //   installmentStats: {
//   //     total: totalInstallments,
//   //     paid: paidInstallments,
//   //     partial: partialInstallments,
//   //     pending: pendingInstallments,
//   //     overdue: overdueInstallments
//   //   }
//   // });
// return successResponse(res, 'Fee statistics retrieved successfully', {
//   academicYear,
//   totalStudents: students.length,
//   totalExpected,
//   totalCollected,
//   totalPending,
//   collectionPercentage: Math.min(100, collectionPercentage),
//   paymentStatus: {
//     paid: completed,
//     unpaid: pending,
//     partial,
//     overdue
//   }
// });


// });

// export const getFeeStatistics = asyncHandler(async (req, res) => {
//   const { academicYear } = req.query;

//   if (!academicYear) {
//     throw new ValidationError('Academic year is required');
//   }

//   // 1️⃣ Get all active students
//   const students = await Student.find({
//     schoolId: req.schoolId,
//     academicYear,
//     status: { $in: ['ENROLLED', 'ACTIVE'] }
//   }).select('_id').lean();

//   const totalStudents = students.length;

//   // 2️⃣ Get all fee payments
//   const feePayments = await FeePayment.find({
//     schoolId: req.schoolId,
//     academicYear
//   }).lean();

//   // ===============================
//   // STUDENT PAYMENT STATUS
//   // ===============================
//   const paidStudentIds = new Set(
//     feePayments
//       .filter(f => f.status === 'PAID')
//       .map(f => String(f.student))
//   );

//   const unpaidStudentIds = new Set();
//   students.forEach(s => {
//     if (!paidStudentIds.has(String(s._id))) {
//       unpaidStudentIds.add(String(s._id));
//     }
//   });

//   const paid = paidStudentIds.size;
//   const unpaid = unpaidStudentIds.size;
//   const partial = feePayments.filter(f => f.status === 'PARTIALLY_PAID').length;
//   const overdue = feePayments.filter(f => f.status === 'OVERDUE').length;

//   // ===============================
//   // AMOUNT CALCULATIONS
//   // ===============================
//   let totalExpected = 0;
//   let totalCollected = 0;
//   let totalPending = 0;

//   feePayments.forEach(fee => {
//     totalExpected += Number(fee.totalDue ?? fee.totalAmount ?? 0);
//     totalCollected += Number(fee.totalPaid ?? fee.paidAmount ?? 0);
//     totalPending += Number(fee.balancePending ?? 0);
//   });

//   // ===============================
//   // COLLECTION %
//   // ===============================
//   const collectionPercentage =
//     totalExpected > 0
//       ? Math.round((totalCollected / totalExpected) * 100)
//       : 0;

//   // ===============================
//   // FINAL RESPONSE
//   // ===============================
//   return successResponse(res, 'Fee statistics retrieved successfully', {
//     academicYear,
//     totalStudents,
//     totalExpected,
//     totalCollected,
//     totalPending,
//     collectionPercentage: Math.min(100, collectionPercentage),
//     paymentStatus: {
//       paid,
//       unpaid,
//       partial,
//       overdue
//     }
//   });
// });

// export const getFeeStatistics = asyncHandler(async (req, res) => {
//   const { academicYear } = req.query;

//   if (!academicYear) {
//     throw new ValidationError('Academic year is required');
//   }

//   /* =======================
//      1️⃣ GET ALL ACTIVE STUDENTS
//      ======================= */
//   const students = await Student.find({
//     schoolId: req.schoolId,
//     academicYear,
//     status: { $in: ['ENROLLED', 'ACTIVE'] }
//   }).select('_id').lean();

//   const totalStudents = students.length;

//   /* =======================
//      2️⃣ GET ALL FEE PAYMENTS
//      ======================= */
//   const feePayments = await FeePayment.find({
//     schoolId: req.schoolId,
//     academicYear
//   }).lean();

//   /* =======================
//      3️⃣ PAID STUDENTS (ONLY PAID)
//      ======================= */
//   const paidStudentIds = new Set(
//     feePayments
//       .filter(fee => fee.status === 'PAID')
//       .map(fee => String(fee.student))
//   );

//   const paid = paidStudentIds.size;

//   /* =======================
//      4️⃣ UNPAID STUDENTS
//      (partial + pending + overdue + no record)
//      ======================= */
//   const unpaidStudentIds = new Set();

//   students.forEach(student => {
//     if (!paidStudentIds.has(String(student._id))) {
//       unpaidStudentIds.add(String(student._id));
//     }
//   });

//   const unpaid = unpaidStudentIds.size;

//   /* =======================
//      5️⃣ OPTIONAL BREAKDOWN
//      ======================= */
//   const partial = feePayments.filter(f => f.status === 'PARTIALLY_PAID').length;
//   const pending = feePayments.filter(f => f.status === 'PENDING').length;
//   const overdue = feePayments.filter(f => f.status === 'OVERDUE').length;

//   /* =======================
//      6️⃣ AMOUNT CALCULATION
//      ======================= */
//   let totalExpected = 0;
//   let totalCollected = 0;
//   let totalPending = 0;

//   feePayments.forEach(fee => {
//     totalExpected += Number(fee.totalDue ?? fee.totalAmount ?? 0);
//     totalCollected += Number(fee.totalPaid ?? fee.paidAmount ?? 0);
//     totalPending += Number(fee.balancePending ?? 0);
//   });

//   /* =======================
//      7️⃣ COLLECTION %
//      ======================= */
//   const collectionPercentage =
//     totalExpected > 0
//       ? Math.round((totalCollected / totalExpected) * 100)
//       : 0;

//   /* =======================
//      8️⃣ FINAL RESPONSE
//      ======================= */
//   return successResponse(res, 'Fee statistics retrieved successfully', {
//     academicYear,
//     totalStudents,
//     totalExpected,
//     totalCollected,
//     totalPending,
//     collectionPercentage: Math.min(collectionPercentage, 100),

//     paymentStatus: {
//       paid,        // ✅ ONLY PAID
//       unpaid,      // ✅ partial + pending + overdue + no record
//       partial,     // optional (for UI breakdown)
//       pending,     // optional
//       overdue      // optional
//     }
//   });
// });

export const getFeeStatistics = asyncHandler(async (req, res) => {
  const { academicYear } = req.query;

  if (!academicYear) {
    throw new ValidationError('Academic year is required');
  }

  // 1️⃣ All fee payments of year
  const feePayments = await FeePayment.find({
    schoolId: req.schoolId,
    academicYear
  }).lean();

  // 2️⃣ Student sets
  const allStudentIds = new Set(
    feePayments.map(fp => String(fp.student))
  );

  const paidStudentIds = new Set(
    feePayments
      .filter(fp => fp.status === 'PAID')
      .map(fp => String(fp.student))
  );

  // 3️⃣ Counts
  const totalStudents = allStudentIds.size;
  const paid = paidStudentIds.size;
  const unpaid = totalStudents - paid;

  const partial = feePayments.filter(f => f.status === 'PARTIALLY_PAID').length;
  const pending = feePayments.filter(f => f.status === 'PENDING').length;
  const overdue = feePayments.filter(f => f.status === 'OVERDUE').length;

  // 4️⃣ Amount calculations
  let totalExpected = 0;
  let totalCollected = 0;
  let totalPending = 0;

  feePayments.forEach(fee => {
    totalExpected += Number(fee.totalDue ?? fee.totalAmount ?? 0);
    totalCollected += Number(fee.totalPaid ?? fee.paidAmount ?? 0);
    totalPending += Number(fee.balancePending ?? 0);
  });

  const collectionPercentage =
    totalExpected > 0
      ? Math.round((totalCollected / totalExpected) * 100)
      : 0;

  // 5️⃣ Response
  return successResponse(res, 'Fee statistics retrieved successfully', {
    academicYear,
    totalStudents,
    totalExpected,
    totalCollected,
    totalPending,
    collectionPercentage: Math.min(collectionPercentage, 100),

    paymentStatus: {
      paid,        // ✅ sirf PAID
      unpaid,      // ✅ partial + pending + overdue
      partial,
      pending,
      overdue
    }
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

    const statusColor =
      feePayment.status === 'PAID'
        ? '#059669'
        : feePayment.status === 'PARTIALLY_PAID'
        ? '#f59e0b'
        : '#dc2626';

    const badgeY = sumInnerTop + 46;
    doc.rect(col2X, badgeY, 100, 22).fill(statusColor).stroke();
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('white')
      .text(
        String(feePayment.status || 'PAID').replace('_', ' '),
        col2X,
        badgeY + 3,
        { width: 100, align: 'center' }
      );

    yPos = sumBoxTop + sumBoxHeight + 25;
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

