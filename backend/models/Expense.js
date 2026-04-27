import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true, default: Date.now },
  paymentMode: { type: String, enum: ['CASH', 'ONLINE', 'CHEQUE', 'CARD', 'BANK_TRANSFER', 'OTHER'], default: 'CASH' },
  source: { 
    type: String, 
    enum: ['MANUAL', 'INVENTORY_PURCHASE', 'PAYROLL', 'TRANSPORT_FUEL', 'MAINTENANCE'],
    required: true,
    default: 'MANUAL'
  },
  referenceId: { type: mongoose.Schema.Types.ObjectId }, // Links back to the original Purchase, FuelLog, or Payroll slip
  description: { type: String }
}, { timestamps: true });

expenseSchema.index({ schoolId: 1, date: -1 });
expenseSchema.index({ schoolId: 1, source: 1, referenceId: 1 });

const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
export default Expense;