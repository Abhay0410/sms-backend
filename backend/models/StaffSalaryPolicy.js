// models/StaffSalaryPolicy.js
import mongoose from 'mongoose';

const schoolPolicySchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, unique: true },
  payrollSettings: {
    basicPercent: { type: Number, default: 50 },
    hraPercent: { type: Number, default: 20 },
    daPercent: { type: Number, default: 10 }
  }
}, { timestamps: true });

export default mongoose.model('SchoolPolicy', schoolPolicySchema);