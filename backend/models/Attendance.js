import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentName: String,
  rollNumber: Number,
  status: { 
    type: String, 
    enum: ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'SICK_LEAVE', 'AUTHORIZED_LEAVE'], 
    required: true 
  },
  remarks: String,
});

const attendanceSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  date: { type: Date, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  className: String,
  section: { type: String, required: true },
  subject: String,
  period: Number,
  academicYear: { type: String, required: true },
  records: [attendanceRecordSchema],
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  markedByName: String,
  totalPresent: { type: Number, default: 0 },
  totalAbsent: { type: Number, default: 0 },
  totalStudents: { type: Number, required: true },
}, { timestamps: true });

attendanceSchema.index({ schoolId: 1 });
attendanceSchema.index({ schoolId: 1, date: 1, class: 1, section: 1 });
attendanceSchema.index({ schoolId: 1, academicYear: 1 });
attendanceSchema.index({ student: 1, date: 1 });

export default mongoose.model('Attendance', attendanceSchema);
