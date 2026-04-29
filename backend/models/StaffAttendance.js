// models/StaffAttendance.js
import mongoose from 'mongoose';

const staffAttendanceSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'], default: 'PRESENT' },
  checkIn: String,
  checkOut: String,
  remarks: String,
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  }
}, { timestamps: true });

export default mongoose.model('StaffAttendance', staffAttendanceSchema);