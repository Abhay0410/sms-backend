// import mongoose from 'mongoose';

// const payrollSchema = new mongoose.Schema({
//   schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
//   month: { type: Number, required: true }, // 1-12
//   year: { type: Number, required: true },
  
//   // Breakup from Teacher Profile at the time of generation
//   baseSalary: Number,
//   allowances: Number,
  
//   // Deductions
//   pensionContribution: { type: Number, default: 0 },
//   unpaidLeaveDeduction: { type: Number, default: 0 },
//   taxDeduction: { type: Number, default: 0 },
  
//   totalDeductions: Number,
//   netSalary: Number,
  
//   status: { type: String, enum: ['DRAFT', 'PAID'], default: 'DRAFT' },
//   paymentDate: Date,
//   transactionId: String
// }, { timestamps: true });

// export default mongoose.model('Payroll', payrollSchema);

import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },

  // Salary breakdown
  baseSalary: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },

  // Deductions
  pensionContribution: { type: Number, default: 0 },
  unpaidLeaveDeduction: { type: Number, default: 0 },
  taxDeduction: { type: Number, default: 0 },

  totalDeductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },

  status: { type: String, enum: ['DRAFT', 'PAID'], default: 'DRAFT' },
  paymentDate: Date,
  transactionId: String
}, { timestamps: true });

// Auto-calculate total deductions and net salary before saving
payrollSchema.pre('save', function(next) {
  this.totalDeductions = (this.pensionContribution || 0) 
                       + (this.unpaidLeaveDeduction || 0) 
                       + (this.taxDeduction || 0);

  this.netSalary = (this.baseSalary || 0) + (this.allowances || 0) - this.totalDeductions;
  next();
});

export default mongoose.model('Payroll', payrollSchema);
