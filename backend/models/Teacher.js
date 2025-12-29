// //models/Teacher.js
// import mongoose from 'mongoose';

// const teacherSchema = new mongoose.Schema({
//   schoolId: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'School', 
//     required: true,
//     // index: true 
//   },
//   name: { type: String, required: true, trim: true },
//   email: { type: String, required: true, unique: true, lowercase: true, trim: true },
//   password: { type: String, required: true },
//   teacherID: { type: String, required: true, unique: true },
  
//   department: { type: String },
//   address: { type: String },

//   // Personal Info
//   dateOfBirth: { type: Date },
//   gender: { type: String, enum: ['Male', 'Female', 'Other'] },
//   bloodGroup: String,
//   nationality: { type: String, default: 'Indian' },
//   aadharNumber: { type: String, unique: true, sparse: true },
//   phone: { type: String, required: true },
//   alternatePhone: String,
  
//   // Professional Info
//   qualification: [String],
//   specialization: [String],
//   experience: Number, // in years
//   previousSchool: String,
//   joiningDate: { type: Date, required: true },
//   employeeType: { 
//     type: String, 
//     enum: ['PERMANENT', 'TEMPORARY', 'CONTRACT', 'GUEST'], 
//     default: 'PERMANENT' 
//   },
  
//   // Academic Responsibilities
//   subjects: [{
//     type: String
//   }],
//   assignedClasses: [{
//     class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
//     section: String,
//     subject: String,
//     isClassTeacher: { type: Boolean, default: false }
//   }],
  
//   // Salary Info
//   salary: {
//     basic: Number,
//     allowances: Number,
//     total: Number,
//     paymentMode: { type: String, enum: ['BANK', 'CASH', 'CHEQUE'], default: 'BANK' },
//     bankDetails: {
//       accountNumber: String,
//       ifscCode: String,
//       bankName: String,
//       branchName: String
//     }
//   },
  
//   // Documents
//   documents: [{
//     name: String,
//     type: String,
//     url: String,
//     uploadedAt: { type: Date, default: Date.now }
//   }],
  
//   profilePicture: String,
  
//   // Emergency Contact
//   emergencyContact: {
//     name: String,
//     relation: String,
//     phone: String
//   },
  
//   // Status
//   status: { 
//     type: String, 
//     enum: ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED'], 
//     default: 'ACTIVE' 
//   },
  
//   role: { type: String, default: 'teacher' },
//   isActive: { type: Boolean, default: true },
// }, { timestamps: true });

// teacherSchema.index({ schoolId: 1 });
// teacherSchema.index({ schoolId: 1, email: 1 });
// teacherSchema.index({ schoolId: 1, teacherID: 1 });

// export default mongoose.model('Teacher', teacherSchema);

// models/Teacher.js
import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
  },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  teacherID: { type: String, required: true, unique: true },
  
  department: { type: String },

  // Address
  address: {
    line1: { type: String },       // full address line
    line2: { type: String },       // optional
    city: { type: String },
    state: { type: String },
    country: { type: String, default: 'India' },
    pincode: { type: String }
  },

  // Personal Info
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  bloodGroup: String,
  nationality: { type: String, default: 'Indian' },
  aadharNumber: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true },
  alternatePhone: String,
  
  // Professional Info
  qualification: [String],
  specialization: [String],
  experience: Number, // in years
  previousSchool: String,
  joiningDate: { type: Date, required: true },
  employeeType: { 
    type: String, 
    enum: ['PERMANENT', 'TEMPORARY', 'CONTRACT', 'GUEST'], 
    default: 'PERMANENT' 
  },
  
  // Academic Responsibilities
  subjects: [String],
  assignedClasses: [{
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    section: String,
    subject: String,
    isClassTeacher: { type: Boolean, default: false }
  }],
  
  // Salary Info
  salary: {
    basic: Number,
    allowances: Number,
    total: Number,
    paymentMode: { type: String, enum: ['BANK', 'CASH', 'CHEQUE'], default: 'BANK' },
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      branchName: String
    }
  },
  
  // Documents
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  profilePicture: String,
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    relation: String,
    phone: String
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED'], 
    default: 'ACTIVE' 
  },
  
  role: { type: String, default: 'teacher' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Indexes
teacherSchema.index({ schoolId: 1 });
teacherSchema.index({ schoolId: 1, email: 1 });
teacherSchema.index({ schoolId: 1, teacherID: 1 });

export default mongoose.model('Teacher', teacherSchema);