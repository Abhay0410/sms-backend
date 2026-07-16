import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g., 'BASIC', 'PRO', 'ENTERPRISE'
  monthlyPrice: { type: Number, required: true, min: 0 },
  yearlyPrice: { type: Number, required: true, min: 0 },
  limits: {
    maxStudents: { type: Number, required: true },
    maxStaff: { type: Number, required: true },
    maxStorageMB: { type: Number, default: 5000 } // Storage limit in Megabytes
  },
  features: [{ type: String }] // e.g., ['TRANSPORT', 'PAYROLL', 'INVENTORY']
}, { timestamps: true });

export default mongoose.model('SubscriptionPlan', subscriptionPlanSchema);