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
  adminID: { type: String, required: true },
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

  // ✅ NEW: Payroll & Compliance for Admin Staff
  panNumber: { type: String, unique: true, sparse: true },
  aadharNumber: { type: String, unique: true, sparse: true },
  
  salary: {
    paymentMode: { type: String, enum: ['BANK', 'CASH', 'CHEQUE'], default: 'BANK' },
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      accountHolderName: String
    },
    uanNumber: String, // PF UAN
  },

  permissions: [{
    module: String,
    actions: [String]
  }],

  isSuperAdmin: { type: Boolean, default: false },

  profilePicture: { type: String, default: '' },
  profilePicturePublicId: { type: String, default: '' },

  role: { type: String, default: 'admin' },
  isActive: { type: Boolean, default: true },
  requiresPasswordChange: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }

}, { timestamps: true });

adminSchema.index({ schoolId: 1 });
adminSchema.index({ schoolId: 1, email: 1 });
adminSchema.index({ schoolId: 1, adminID: 1 }, { unique: true }); // ✅ Ensures adminID is unique ONLY within the same school

// ✅ TEXT INDEX FOR SEARCH OPTIMIZATION
adminSchema.index(
  { name: 'text', email: 'text', adminID: 'text' },
  { 
    weights: { adminID: 3, name: 2, email: 1 } 
  }
);

// ✅ SOFT DELETE MIDDLEWARE
adminSchema.pre(/^find/, function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});
adminSchema.pre('countDocuments', function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});
adminSchema.pre('aggregate', function(next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

const Admin = mongoose.model('Admin', adminSchema);

// ✅ This tells Mongoose to delete old indexes from MongoDB that are no longer in this schema (like the old adminID_1 global index)
Admin.syncIndexes().then(() => console.log('Admin indexes synced successfully.')).catch(console.error);

export default Admin;