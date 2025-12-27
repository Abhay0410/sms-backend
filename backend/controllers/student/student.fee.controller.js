// controllers/student/student.fee.controller.js
import FeePayment from '../../models/FeePayment.js';
import Student from '../../models/Student.js';
import PDFDocument from 'pdfkit';
import School from "../../models/School.js";
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { NotFoundError } from '../../utils/errors.js';

const safeNumber = (v) => {
  const num = Number(v ?? 0);
  return isNaN(num) ? 0 : num;
};

const formatAmount = (val) => {
  const num = Number(val || 0);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

// Helper to draw currency + amount separately (SAME AS ADMIN)
const drawAmount = (doc, amount, xPos, yPos, fontSize, color) => {
  const formattedAmount = formatAmount(amount);
  doc.fontSize(fontSize).font("Helvetica-Bold").fillColor(color);
  doc.text("Rs. ", xPos, yPos, { continued: true });
  doc.text(formattedAmount);
};

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// 1. Current year fee status (with installments)
export const getFeeStatus = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const academicYear = req.query.academicYear || getCurrentAcademicYear();

  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  if (!student) throw new NotFoundError('Student');

  const feePayment = await FeePayment.findOne({
    schoolId: req.schoolId,
    student: studentId,
    academicYear
  }).populate('payments.receivedBy', 'name adminID');

  if (!feePayment) {
    throw new NotFoundError('Fee payment record');
  }

  const pendingInstallments = (feePayment.installments || []).filter(
    inst => inst.status !== 'PAID'
  );
  pendingInstallments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const nextInstallment = pendingInstallments[0] || null;

  return successResponse(res, 'Fee status retrieved successfully', {
    ...feePayment.toObject(),
    nextInstallment: nextInstallment
      ? {
          name: nextInstallment.name,
          dueDate: nextInstallment.dueDate,
          pendingAmount: (nextInstallment.amount || 0) - (nextInstallment.paidAmount || 0),
          status: nextInstallment.status
        }
      : null
  });
});

// 2. Full history
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  if (!student) throw new NotFoundError('Student');

  const feePayments = await FeePayment.find({
    schoolId: req.schoolId,
    student: studentId
  })
    .populate('payments.receivedBy', 'name adminID')
    .sort({ academicYear: -1 });

  return successResponse(res, 'Payment history retrieved successfully', feePayments);
});

// Get fee receipt details - MULTI-TENANT
export const getFeeReceipt = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { feePaymentId, paymentId } = req.params;
  
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const feePayment = await FeePayment.findOne({
    schoolId: req.schoolId,
    _id: feePaymentId,
    student: studentId
  }).populate('payments.receivedBy', 'name adminID');
  
  if (!feePayment) {
    throw new NotFoundError('Fee payment record');
  }
  
  const payment = feePayment.payments.id(paymentId);
  
  if (!payment) {
    throw new NotFoundError('Payment record');
  }
  
  return successResponse(res, 'Fee receipt retrieved successfully', {
    student: {
      name: feePayment.studentName,
      studentID: feePayment.studentID,
      className: feePayment.className,
      section: feePayment.section
    },
    payment: {
      receiptNumber: payment.receiptNumber,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMode: payment.paymentMode,
      transactionId: payment.transactionId,
      receivedBy: payment.receivedBy ? payment.receivedBy.name : 'N/A',
      remarks: payment.remarks
    },
    feeDetails: {
      totalAmount: feePayment.totalAmount,
      paidAmount: feePayment.paidAmount,
      pendingAmount: feePayment.pendingAmount,
      discount: feePayment.discount,
      status: feePayment.status
    },
    feeStructure: feePayment.feeStructure
  });
});

// ✅ FIXED: Download fee receipt - EXACTLY LIKE ADMIN CONTROLLER
export const downloadFeeReceipt = asyncHandler(async (req, res) => {
  try {
    const studentId = req.user.id;
    const { feePaymentId, paymentId } = req.params;

    console.log("📥 Student PDF Download START:", {
      feePaymentId,
      paymentId,
      studentId,
    });

    // 1) Find FeePayment scoped to school + student
    const feePayment = await FeePayment.findOne({
      schoolId: req.schoolId,
      _id: feePaymentId,
      student: studentId,
      "payments._id": paymentId,
    })
      .populate(
        "student",
        "name studentID rollNumber className section fatherName motherName address phone"
      )
      .populate("payments.receivedBy", "name adminID");

    if (!feePayment) {
      console.log("❌ FeePayment not found for student/school");
      return res.status(404).end();
    }

    const payment = feePayment.payments.id(paymentId);
    if (!payment) {
      console.log("❌ Payment subdoc not found");
      return res.status(404).end();
    }

    // 2) School info
    const school = await School.findById(req.schoolId).lean();
    const schoolName = school?.schoolName || "Your School Name";
    const schoolPhone = school?.phone || "";
    const schoolEmail = school?.adminEmail || "";
    const schoolAddressLine = [
      school?.address?.city,
      school?.address?.state,
      school?.address?.country,
    ]
      .filter(Boolean)
      .join(", ");

    // 3) Safe numbers - EXACTLY LIKE ADMIN
    const totalAmount = Number(feePayment.totalAmount || feePayment.totalDue || 0);
    const totalPaid = Number(feePayment.totalPaid || feePayment.paidAmount || 0);
    const pending = Number(
      feePayment.balancePending ?? 
      feePayment.pendingAmount ?? 
      totalAmount - totalPaid
    ) || 0;

    // 4) Headers - PDF download EXACTLY LIKE ADMIN
    // Student name + receipt number format
    const studentName = feePayment.student?.name || feePayment.studentName || "Student";
    const safeStudentName = studentName
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .substring(0, 30) || "Student";

    res.set({
      "Content-Type": "application/pdf",
      // Student name format like admin suggested
      "Content-Disposition": `attachment; filename="${safeStudentName}_Fee_Receipt_${payment.receiptNumber}.pdf"`,
      "Cache-Control": "no-cache",
    });

    const doc = new PDFDocument({ compress: false, size: "A4", margin: 40 });
    doc.pipe(res);

    const pageWidth = 595;
    const marginLeft = 40;
    const marginRight = 40;
    const contentWidth = pageWidth - marginLeft - marginRight;

    // ───────────── HEADER ─────────────
    doc.rect(marginLeft, 30, contentWidth, 80).fill("#1e3a8a");

    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text(schoolName.toUpperCase(), marginLeft + 20, 45, {
        width: contentWidth - 40,
      });

    doc
      .fontSize(10)
      .fillColor("#e2e8f0")
      .text(schoolAddressLine || "School Address", marginLeft + 20, 75, {
        width: contentWidth - 40,
      })
      .text(
        [schoolPhone && `Phone: ${schoolPhone}`, schoolEmail && `Email: ${schoolEmail}`]
          .filter(Boolean)
          .join(" | "),
        marginLeft + 20,
        90,
        { width: contentWidth - 40 }
      );

    // ───────────── TITLE ─────────────
    let yPos = 130;
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("#1e40af")
      .text("OFFICIAL FEE RECEIPT", marginLeft, yPos, {
        align: "center",
        width: contentWidth,
      });

    doc
      .moveTo(marginLeft + 100, yPos + 25)
      .lineTo(marginLeft + contentWidth - 100, yPos + 25)
      .stroke("#1e40af");

    // ───────────── RECEIPT INFO ─────────────
    yPos += 45;
    const boxHeight = 50;
    doc.rect(marginLeft, yPos, contentWidth, boxHeight).stroke("#cbd5e1").lineWidth(1);

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#1f2937")
      .text("Receipt Number:", marginLeft + 15, yPos + 10);
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#0f172a")
      .text(String(payment.receiptNumber || "N/A"), marginLeft + 15, yPos + 25);

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#1f2937")
      .text("Receipt Date:", marginLeft + 180, yPos + 10);
    doc
      .fontSize(12)
      .fillColor("#0f172a")
      .text(
        new Date(payment.paymentDate || Date.now()).toLocaleDateString(
          "en-IN",
          { day: "2-digit", month: "long", year: "numeric" }
        ),
        marginLeft + 180,
        yPos + 25
      );

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#1f2937")
      .text("Academic Year:", marginLeft + 350, yPos + 10);
    doc
      .fontSize(12)
      .fillColor("#0f172a")
      .text(String(feePayment.academicYear || "N/A"), marginLeft + 350, yPos + 25);

    yPos += boxHeight + 15;

    // ───────────── STUDENT INFO ─────────────
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1e293b")
      .text("STUDENT INFORMATION", marginLeft, yPos);

    yPos += 18;
    doc.rect(marginLeft, yPos, contentWidth, 65).stroke("#cbd5e1").lineWidth(1.5);

    const infoYPos = yPos + 10;

    const displayStudentName =
      feePayment.student?.name || feePayment.studentName || "N/A";
    const studentID =
      feePayment.student?.studentID || feePayment.studentID || "N/A";
    const className =
      feePayment.student?.className || feePayment.className || "N/A";
    const section = feePayment.student?.section || feePayment.section || "";

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#475569")
      .text("Name:", marginLeft + 15, infoYPos);
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(displayStudentName.toUpperCase(), marginLeft + 80, infoYPos, {
        width: 200,
      });

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#475569")
      .text("Student ID:", marginLeft + 15, infoYPos + 18);
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(studentID, marginLeft + 80, infoYPos + 18);

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#475569")
      .text("Class:", marginLeft + 15, infoYPos + 36);
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(
        `${className}${section ? ` - Section ${section}` : ""}`,
        marginLeft + 80,
        infoYPos + 36
      );

    if (feePayment.student?.rollNumber) {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Roll No:", marginLeft + 320, infoYPos);
      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(String(feePayment.student.rollNumber), marginLeft + 390, infoYPos);
    }

    yPos += 90;

    // ───────────── PAYMENT DETAILS ─────────────
    doc.y = yPos;
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1e293b")
      .text("PAYMENT DETAILS", marginLeft, doc.y);

    doc.moveDown(0.5);

    const payBoxTop = doc.y;
    const payBoxHeight = 80;

    doc
      .rect(marginLeft, payBoxTop, contentWidth, payBoxHeight)
      .fill("#f0fdf4")
      .stroke("#22c55e")
      .lineWidth(2);

    const payInnerTop = payBoxTop + 10;
    doc
      .rect(marginLeft + 15, payInnerTop - 2, 110, 25)
      .fill("#3b82f6")
      .stroke();

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text(
        (payment.paymentMode || "CASH").toUpperCase(),
        marginLeft + 15,
        payInnerTop + 2,
        { width: 110, align: "center" }
      );

    // ✅ FIXED: Use drawAmount helper EXACTLY LIKE ADMIN
    // Payment amount - using drawAmount (not ₹ symbol)
    drawAmount(doc, payment.amount, marginLeft + 140, payInnerTop, 26, "#059669");

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#64748b")
      .text("Amount Paid", marginLeft + 140, payInnerTop + 30);

    let payDetailY = payInnerTop + 48;
    doc.fontSize(10).font("Helvetica").fillColor("#475569");

    if (payment.transactionId) {
      doc.text(
        `Transaction ID: ${payment.transactionId}`,
        marginLeft + 15,
        payDetailY
      );
      payDetailY += 12;
    }

    if (payment.remarks) {
      doc.text(`Remarks: ${payment.remarks}`, marginLeft + 15, payDetailY);
      payDetailY += 12;
    }

    yPos = payBoxTop + payBoxHeight + 20;
    doc.y = yPos;

    // ───────────── FEE SUMMARY ─────────────
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1e293b")
      .text("FEE SUMMARY", marginLeft, doc.y);

    doc.moveDown(0.5);

    const sumBoxTop = doc.y;
    const sumBoxHeight = 80;

    doc
      .rect(marginLeft, sumBoxTop, contentWidth, sumBoxHeight)
      .fill("#fef3c7")
      .stroke("#f59e0b")
      .lineWidth(1.5);

    const col1X = marginLeft + 20;
    const col2X = marginLeft + 260;
    const sumInnerTop = sumBoxTop + 12;

    // ✅ FIXED: Total Fee - using drawAmount
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#92400e")
      .text("Total Fee:", col1X, sumInnerTop);
    drawAmount(doc, totalAmount, col1X, sumInnerTop + 16, 12, "#111827");

    // ✅ FIXED: Total Paid - using drawAmount
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#92400e")
      .text("Total Paid:", col1X, sumInnerTop + 36);
    drawAmount(doc, totalPaid, col1X, sumInnerTop + 52, 12, "#111827");

    // ✅ FIXED: Balance Due - using drawAmount
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#92400e")
      .text("Balance Due:", col2X, sumInnerTop);
    drawAmount(doc, pending, col2X, sumInnerTop + 16, 14, 
               pending > 0 ? "#dc2626" : "#059669");

    const statusColor =
      feePayment.status === "PAID"
        ? "#059669"
        : feePayment.status === "PARTIALLY_PAID"
        ? "#f59e0b"
        : "#dc2626";

    const badgeY = sumInnerTop + 46;
    doc.rect(col2X, badgeY, 100, 22).fill(statusColor).stroke();
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text(
        String(feePayment.status || "PAID").replace("_", " "),
        col2X,
        badgeY + 3,
        { width: 100, align: "center" }
      );

    yPos = sumBoxTop + sumBoxHeight + 25;
    doc.y = yPos;

    // ───────────── SIGNATURE + FOOTER ─────────────
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1e293b")
      .text("AUTHORIZED SIGNATURE", marginLeft, doc.y);

    doc.moveDown(1);

    const sigLineY = doc.y + 20;

    doc
      .moveTo(marginLeft + 15, sigLineY)
      .lineTo(marginLeft + 150, sigLineY)
      .stroke("#374151")
      .lineWidth(1.2);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#64748b")
      .text("Received By", marginLeft + 15, sigLineY + 4);

    const dateX = marginLeft + 260;
    doc
      .moveTo(dateX, sigLineY)
      .lineTo(dateX + 135, sigLineY)
      .stroke("#374151")
      .lineWidth(1.2);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#64748b")
      .text("Date", dateX, sigLineY + 4);

    yPos = sigLineY + 40;

    doc
      .rect(marginLeft, yPos, contentWidth, 50)
      .fill("#f8fafc")
      .stroke("#e2e8f0")
      .lineWidth(1);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#6b7280")
      .text(
        "This is a computer-generated official receipt. No signature required for validity.",
        marginLeft + 15,
        yPos + 10,
        { align: "center", width: contentWidth - 30 }
      )
      .text(
        `Generated on: ${new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        })}`,
        marginLeft + 15,
        yPos + 28,
        { align: "center", width: contentWidth - 30 }
      );

    doc
      .fontSize(7)
      .fillColor("#94a3b8")
      .text(
        "For any queries, contact the school office",
        marginLeft + 15,
        yPos + 38,
        { align: "center", width: contentWidth - 30 }
      );

    doc.end();
    console.log("✅ Student PDF generated for:", studentName, "Receipt:", payment.receiptNumber);
  } catch (error) {
    console.error("💥 Student PDF ERROR:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "PDF generation failed" });
    } else {
      res.end();
    }
  }
});

export default {
  getFeeStatus,
  getPaymentHistory,
  getFeeReceipt,
  downloadFeeReceipt
};