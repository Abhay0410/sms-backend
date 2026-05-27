import mongoose from 'mongoose';

const superAdminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'support'], default: 'superadmin' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date }
}, { timestamps: true });

export default mongoose.model('SuperAdmin', superAdminSchema);