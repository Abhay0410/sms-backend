import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema({
  schoolName: { type: String, required: true, trim: true },
  schoolCode: { type: String, required: true, unique: true, uppercase: true },
  adminEmail: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true },
  address: {
    street: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: String,
    country: { type: String, default: 'India' }
  },
  logo: String,
  isActive: { type: Boolean, default: true },
  subscriptionPlan: { type: String, default: 'BASIC' },
  maxStudents: { type: Number, default: 1000 },
  setupCompleted: { type: Boolean, default: false }
}, { timestamps: true });

schoolSchema.index({ isActive: 1 });

export default mongoose.model('School', schoolSchema);