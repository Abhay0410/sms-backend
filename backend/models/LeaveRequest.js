import mongoose from 'mongoose'; 

const leaveRequestSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  leaveType: { type: String, enum: ['SICK', 'CASUAL', 'UNPAID'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  adminRemarks: String
}, { timestamps: true });

export default mongoose.model('LeaveRequest', leaveRequestSchema);