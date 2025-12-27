import mongoose from 'mongoose';

const examSubjectSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  subjectCode: String,
  examDate: { type: Date, required: true },
  startTime: String,
  endTime: String,
  duration: Number,
  totalMarks: { type: Number, required: true },
  passingMarks: { type: Number, required: true },
  room: String,
  invigilator: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
});

const examSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  examName: { type: String, required: true },
  examType: { 
    type: String, 
    enum: ['FINAL', 'HALF_YEARLY', 'QUARTERLY', 'UNIT_TEST', 'MID_TERM', 'MONTHLY'], 
    required: true 
  },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  className: String,
  sections: [String],
  academicYear: { type: String, required: true },
  subjects: [examSubjectSchema],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  instructions: String,
  syllabus: String,
  status: { 
    type: String, 
    enum: ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'], 
    default: 'SCHEDULED' 
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

examSchema.index({ schoolId: 1 });
examSchema.index({ schoolId: 1, class: 1, academicYear: 1, examType: 1 });

export default mongoose.model('Exam', examSchema);
