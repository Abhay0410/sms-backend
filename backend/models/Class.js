// models/Class.js
import mongoose from 'mongoose';

// 1. Fee Rule Schema
const feeRuleSchema = new mongoose.Schema({
  head: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeHead', required: false },
  headName: { type: String, required: true },
  frequency: { 
    type: String, 
    enum: ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME'], 
    required: true 
  },
  amount: { type: Number, required: true },
  months: [{ type: String }],
  dueDateDay: { type: Number, default: 10 },
  isOptional: { type: Boolean, default: false }
});

// 2. Subject Schema
const subjectSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  subjectName: { type: String, required: true },
  subjectCode: String,
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  hasTheory: { type: Boolean, default: true },
  hasPractical: { type: Boolean, default: false },
  hasIA: { type: Boolean, default: true },
  theoryMaxMarks: { type: Number, default: 100 },
  practicalMaxMarks: { type: Number, default: 0 },
  iaMaxMarks: { type: Number, default: 0 },
});

// 3. Section Schema
const sectionSchema = new mongoose.Schema({
  sectionName: { type: String, required: true },
  classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  capacity: { type: Number, default: 50 },
  currentStrength: { type: Number, default: 0 },
  subjects: [subjectSchema],
  room: String,
});

// 4. Class Schema
const classSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  className: { type: String, required: true },
  classNumeric: { type: Number },
  academicYear: { type: String, required: true },

  sections: [sectionSchema],

  feeStructure: [feeRuleSchema],

  feeSettings: {
    totalAnnualFee: { type: Number, default: 0 },
    lateFeeAmount: { type: Number, default: 0 },
    lateFeeApplicableAfter: Date
  },

  commonSubjects: [String],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

classSchema.index({ schoolId: 1 });
classSchema.index({ schoolId: 1, className: 1, academicYear: 1 });

export default mongoose.model('Class', classSchema);