// models/Student.js
import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const studentSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  name: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    sparse: true, 
    lowercase: true, 
    trim: true,
    set: v => (v === '' || v === null) ? undefined : v // 🔥 Converts empty string to undefined
  },
  mobileNumber: { type: String, required: true },
  password: { type: String, required: true },
  studentID: { type: String, required: true },

   // ✅ NEW FIELDS
  enrollmentNumber: { type: String, trim: true },
  scholarNumber: { type: String, trim: true },

  rollNumber: { type: Number },
  dateOfBirth: { type: Date },
  phone: { type: String }, 
  lastLogin: { type: Date },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  bloodGroup: { type: String },
  religion: { type: String },
  caste: { type: String },
  nationality: { type: String, default: 'Indian' },
  aadharNumber: { type: String, unique: true, sparse: true },
  
  isHandicapped: { type: Boolean, default: false },
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  parent: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Parent"
},


bankName: String,
  accountNumber: String,
  ifscCode: String,
  accountHolderName: String,
  scholarshipName: String,
  ssid: String,

  
  // Parents/Guardian Info
  fatherName: { type: String, required: true },
  fatherOccupation: String,
  fatherPhone: String,
  fatherEmail: String,
  fatherQualification: String,
  motherName: String,
  motherOccupation: String,
  motherPhone: String,
  motherEmail: String,
motherQualification: String,
  guardianName: String,
  guardianRelation: String,
  guardianPhone: String,
  guardianEmail: String,
  
  // Academic Info
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  className: { type: String, required: true },
  section: { type: String },
  academicYear: { type: String, required: true },
  admissionDate: { type: Date, default: Date.now },
  admissionNumber: String,
  previousSchool: String,
  
  // Status
  status: { 
    type: String, 
    enum: ['REGISTERED', 'ENROLLED', 'SUSPENDED', 'WITHDRAWN', 'GRADUATED', 'TRANSFERRED'], 
    default: 'REGISTERED' 
  },
  
  // Medical Info
  medicalHistory: String,
  allergies: [String],
  emergencyContact: {
    name: String,
    relation: String,
    phone: String
  },
  
  // Documents
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  profilePicture: String,
  
  // Transport
  transportRequired: { type: Boolean, default: false },
  busRoute: String,
  pickupPoint: String,
  
  // Hostel
  hostelResident: { type: Boolean, default: false },
  hostelBlock: String,
  roomNumber: String,
  
  role: { type: String, default: 'student' },
  isActive: { type: Boolean, default: true },
  requiresPasswordChange: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

studentSchema.plugin(mongoosePaginate);
studentSchema.index({ schoolId: 1 });
studentSchema.index({ schoolId: 1, studentID: 1 }, { unique: true });
studentSchema.index(
  { schoolId: 1, email: 1 }, 
  { 
    unique: true, 
    sparse: true, 
    partialFilterExpression: { email: { $type: "string" } } 
  }
);

// ✅ NEW UNIQUE INDEXES (IMPORTANT)
studentSchema.index(
  { schoolId: 1, enrollmentNumber: 1 },
  { unique: true, sparse: true }
);

studentSchema.index({ schoolId: 1, class: 1, section: 1 });
studentSchema.index({ schoolId: 1, academicYear: 1, status: 1 });

// ✅ TEXT INDEX FOR SEARCH OPTIMIZATION
studentSchema.index(
  { name: 'text', email: 'text', studentID: 'text', fatherName: 'text' },
  { 
    weights: { studentID: 3, name: 2, fatherName: 1, email: 1 } 
  }
);

// ✅ SOFT DELETE MIDDLEWARE
studentSchema.pre(/^find/, function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});
studentSchema.pre('countDocuments', function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});
studentSchema.pre('aggregate', function(next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

export default mongoose.model('Student', studentSchema);
