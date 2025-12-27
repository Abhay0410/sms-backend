//models/Result.js
import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  subjectName: { type: String, required: true },
  subjectCode: { type: String },
  theoryMaxMarks: { type: Number, default: 0 },
  theoryObtainedMarks: { type: Number, default: 0 },
  practicalMaxMarks: { type: Number, default: 0 },
  practicalObtainedMarks: { type: Number, default: 0 },
  iaMaxMarks: { type: Number, default: 0 },
  iaObtainedMarks: { type: Number, default: 0 },
  graceMarks: { type: Number, default: 0 },
  totalMaxMarks: { type: Number, required: true },
  totalObtainedMarks: { type: Number, required: true },
  percentage: { type: Number, required: true },
  grade: { type: String, required: true },
  status: { type: String, enum: ['PASS', 'FAIL', 'PASS_BY_GRACE', 'ABSENT'], required: true },
  isAbsent: { type: Boolean, default: false },
  hasPractical: { type: Boolean, default: false },
});

const resultSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentName: { type: String, required: true },
  studentID: { type: String, required: true },
  rollNumber: { type: Number, required: true },
  fatherName: { type: String },
  motherName: { type: String },
  dob: { type: Date },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  className: { type: String, required: true },
  section: { type: String, required: true },
  examType: { 
    type: String, 
    enum: ['FINAL', 'HALF_YEARLY', 'QUARTERLY', 'UNIT_TEST', 'MID_TERM'], 
    required: true 
  },
  examName: { type: String },
  examMonth: { type: String },
  examYear: { type: Number, required: true },
  academicYear: { type: String, required: true },
  subjects: [subjectSchema],
  totalMaxMarks: { type: Number, required: true },
  totalObtainedMarks: { type: Number, required: true },
  totalGraceMarks: { type: Number, default: 0 },
  overallPercentage: { type: Number, required: true },
  overallGrade: { type: String, required: true },
  result: { 
    type: String, 
    enum: ['PASS', 'FAIL', 'PASS_BY_GRACE', 'ABSENT'], 
    required: true 
  },
  division: { 
    type: String, 
    enum: ['FIRST', 'SECOND', 'THIRD', 'FAIL'], 
    required: true 
  },
  totalWorkingDays: { type: Number, default: 0 },
  daysPresent: { type: Number, default: 0 },
  attendancePercentage: { type: Number, default: 0 },
  remarks: { type: String },
  preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  preparedByName: { type: String, required: true },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approvedAt: { type: Date },
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
  version: { type: Number, default: 1 },
  history: [{
    modifiedAt: { type: Date, default: Date.now },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId },
    changes: { type: String }
  }]
}, { timestamps: true });

resultSchema.index({ schoolId: 1 });
resultSchema.index({ schoolId: 1, student: 1, examType: 1, academicYear: 1 }, { unique: true });
resultSchema.index({ schoolId: 1, class: 1, section: 1, examType: 1 });
resultSchema.index({ schoolId: 1, academicYear: 1, isApproved: 1, isPublished: 1 });

export default mongoose.model('Result', resultSchema);
