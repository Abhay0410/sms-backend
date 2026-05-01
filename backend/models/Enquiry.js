import mongoose from 'mongoose';

const enquirySchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'School'
  },
  academicYear: {
    type: String,
    required: true
  },
  enquiryDate: {
    type: Date,
    default: Date.now
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin' // Can also be referenced to 'User' or 'Staff' depending on your auth setup
  },
  
  // Student Details
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number
  },
  targetClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  previousSchool: {
    type: String,
    trim: true
  },

  // Parent Details
  parentName: {
    type: String,
    required: true,
    trim: true
  },
  primaryPhone: {
    type: String,
    required: true,
    trim: true
  },
  secondaryPhone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    type: String
  },
  occupation: {
    type: String
  },

  // Metadata & Sales Pipeline Flow
  source: {
    type: String,
    enum: ['WALK_IN', 'WEBSITE', 'FACEBOOK', 'REFERRAL', 'NEWSPAPER', 'OTHER'],
    default: 'WALK_IN'
  },
  priority: {
    type: String,
    enum: ['HOT', 'WARM', 'COLD'],
    default: 'WARM'
  },
  status: {
    type: String,
    enum: ['NEW', 'PENDING', 'FOLLOWED_UP', 'VISITED', 'ADMITTED', 'CLOSED_LOST'],
    default: 'NEW'
  },
  latestFollowUpDate: { type: Date },
  nextActionDate: { type: Date },
  closeReason: { type: String }
}, { timestamps: true });

const Enquiry = mongoose.model('Enquiry', enquirySchema);
export default Enquiry;