import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true, 
  },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  adminID: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  

  dateOfBirth: Date,
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },

  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },

  designation: String,
  department: String,
  joiningDate: { type: Date, default: Date.now },

  permissions: [{
    module: String,
    actions: [String]
  }],

  isSuperAdmin: { type: Boolean, default: false },

profilePicture: { type: String, default: '' },
profilePicturePublicId: { type: String, default: '' },

role: { type: String, default: 'admin' },
isActive: { type: Boolean, default: true },

}, { timestamps: true });

adminSchema.index({ schoolId: 1 });
adminSchema.index({ schoolId: 1, email: 1 });
// adminSchema.index({ adminID: 1 });


export default mongoose.model('Admin', adminSchema);