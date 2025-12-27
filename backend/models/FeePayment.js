import mongoose from 'mongoose';

// Individual Installment (e.g., "April Tuition")
const installmentSchema = new mongoose.Schema({
  head: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeHead' },
  headName: { type: String, required: true }, // e.g., "Tuition Fee"
  name: { type: String, required: true }, // e.g., "April Tuition"
  amount: { type: Number, required: true }, // Due Amount
  paidAmount: { type: Number, default: 0 }, // How much paid so far
  dueDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED'], 
    default: 'PENDING' 
  },
  waivedAmount: { type: Number, default: 0 }, // Scholarship/Discount
  waivedReason: String
});

const transactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  mode: { 
    type: String, 
    enum: ['CASH', 'CHEQUE', 'ONLINE', 'UPI', 'NEFT'], 
    required: true 
  },
  receiptNumber: { type: String, required: true },
  transactionId: String, // Bank Ref ID
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }, // or User
  remarks: String,
  installmentsCovered: [{ // Tracks which installments this specific payment covered
    installmentId: mongoose.Schema.Types.ObjectId,
    amount: Number // How much of this receipt went to this installment
  }]
});

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  paymentDate: { type: Date, required: true },
  paymentMode: { type: String, required: true },
  receiptNumber: { type: String, required: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  remarks: String,
  transactionId: String,
  chequeNumber: String,
  bankName: String,
  upiId: String,
  installmentsCovered: [{
    installmentId: mongoose.Schema.Types.ObjectId,
    installmentName: String,
    amount: Number
  }]
});

const feePaymentSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  academicYear: { type: String, required: true },
  
  // Flattened info for search performance
  studentName: String,
  studentID: String,
  className: String,
  section: String,

  installments: [installmentSchema], // 👈 The detailed breakdown
  transactions: [transactionSchema], // 👈 The payment history
  payments: [paymentSchema], // 👈 Payments as recorded by admin

  // Summary Counters (Auto-calculated)
  totalDue: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  totalWaived: { type: Number, default: 0 },
  balancePending: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    enum: ['PAID', 'PARTIAL', 'PENDING', 'OVERDUE'], 
    default: 'PENDING' 
  }
}, { timestamps: true });

// Indexing for fast dashboard loading
feePaymentSchema.index({ schoolId: 1, academicYear: 1 });
feePaymentSchema.index({ student: 1, academicYear: 1 });
feePaymentSchema.index({ "installments.status": 1 });

export default mongoose.model('FeePayment', feePaymentSchema);
