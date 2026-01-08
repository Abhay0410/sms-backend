import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  
  // Breakup from Teacher Profile at the time of generation
  baseSalary: Number,
  allowances: Number,
  
  // Deductions
  pensionContribution: { type: Number, default: 0 },
  unpaidLeaveDeduction: { type: Number, default: 0 },
  taxDeduction: { type: Number, default: 0 },
  
  totalDeductions: Number,
  netSalary: Number,
  
  status: { type: String, enum: ['DRAFT', 'PAID'], default: 'DRAFT' },
  paymentDate: Date,
  transactionId: String
}, { timestamps: true });

export default mongoose.model('Payroll', payrollSchema);