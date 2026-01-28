//models/Payroll.js
import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  month: { type: String }, // e.g., "JANUARY"
  isTemplate: { type: Boolean, default: false },
  year: { type: Number },  // 2026
  
  // Master Structure
  ctc: { type: Number, required: true }, // Cost to Company
  grossSalary: { type: Number, required: true },
  
  // Earnings Breakdown
  earnings: {
    basic: { type: Number, required: true }, // Should be 50% of Gross
    da: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    teachingAllowance: { type: Number, default: 0 }
  },
  
  // Deductions Breakdown
  deductions: {
    epfEmployee: { type: Number, default: 0 }, // 12% of Basic + DA
    professionalTax: { type: Number, default: 200 }, // PT as per State
    tds: { type: Number, default: 0 }, // Income Tax
    otherDeductions: { type: Number, default: 0 }
  },
  
  // Statutory (Outside In-hand)
  statutory: {
    epfEmployer: { type: Number, default: 0 },
    gratuityProvision: { type: Number, default: 0 } // Monthly provision
  },
  
  // Payment Details
  netSalary: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' },
  paymentDate: Date,
  transactionId: String, // UTR Number
  paymentMode: { type: String, enum: ['NEFT', 'IMPS', 'CASH', 'CHEQUE'] },
  
  // Context
  taxRegime: { type: String, enum: ['OLD', 'NEW'], default: 'NEW' }, // 2026 Default
  attendanceDays: { type: Number, default: 30 }
}, { timestamps: true });

export default mongoose.model('Payroll', payrollSchema);