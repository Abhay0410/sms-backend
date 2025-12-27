//models/Timetable.js 
import mongoose from 'mongoose';

const periodSchema = new mongoose.Schema({
  periodNumber: { type: Number, required: true },
  subject: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  startTime: { type: String, required: true }, // "09:00"
  endTime: { type: String, required: true },   // "09:45"
  room: String,
  isBreak: { type: Boolean, default: false },
  breakType: String,
}, { _id: true });

const dayScheduleSchema = new mongoose.Schema({
  day: { 
    type: String, 
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true 
  },
  periods: [periodSchema],
});

const timetableSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  className: String,
  section: { type: String, required: true },
  academicYear: { type: String, required: true },
  
  schedule: [dayScheduleSchema],
  
  effectiveFrom: { type: Date, default: Date.now },
  effectiveTo: Date,
  
  isActive: { type: Boolean, default: true },
  status: { 
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  publishedAt: Date,
}, { timestamps: true });

timetableSchema.index({ schoolId: 1 });
timetableSchema.index({ schoolId: 1, class: 1, section: 1, academicYear: 1 });

export default mongoose.model('Timetable', timetableSchema);
