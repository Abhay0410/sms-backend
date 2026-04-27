import mongoose from 'mongoose';

const expenseCategorySchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  isSystemGenerated: { type: Boolean, default: false } // True for core categories like 'Payroll', 'Transport' so admin cannot delete them
}, { timestamps: true });

// Prevent duplicate category names per school
expenseCategorySchema.index({ schoolId: 1, name: 1 }, { unique: true });

const ExpenseCategory = mongoose.models.ExpenseCategory || mongoose.model('ExpenseCategory', expenseCategorySchema);
export default ExpenseCategory;