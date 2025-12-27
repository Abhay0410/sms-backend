//models/Parent.js
import mongoose from 'mongoose';

const parentSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  parentID: { type: String, required: true, unique: true },
  phone: { type: String },
  relation: { 
    type: String, 
    enum: ['Father', 'Mother', 'Guardian'],
    required: true 
  },
  occupation: { type: String },
  qualification: { type: String },
  income: { type: Number },
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  
  // Children references
  children: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student' 
  }],
  profilePicture: { type: String },
  lastLogin: { type: Date },
  role: { type: String, default: 'parent' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

parentSchema.index({ schoolId: 1 });
parentSchema.index({ schoolId: 1, email: 1 });
// parentSchema.index({ parentID: 1 });
// parentSchema.index({ email: 1 });

export default mongoose.model('Parent', parentSchema);
