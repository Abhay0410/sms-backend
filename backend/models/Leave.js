import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  applicant: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'applicantModel', 
    required: true 
  },
  applicantModel: { 
    type: String, 
    enum: ['Student', 'Teacher'], 
    required: true 
  },
  applicantName: String,
  applicantID: String,
  leaveType: { 
    type: String, 
    enum: ['SICK', 'CASUAL', 'VACATION', 'MATERNITY', 'EMERGENCY', 'OTHER'], 
    required: true 
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  numberOfDays: { type: Number, required: true },
  reason: { type: String, required: true },
  
  // Attachments
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], 
    default: 'PENDING' 
  },
  
  // Approval
  approvedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'approvedByModel' },
  approvedByModel: { type: String, enum: ['Admin', 'Teacher'] },
  approvedAt: Date,
  approvalRemarks: String,
  
  // Rejection
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'rejectedByModel' },
  rejectedByModel: { type: String, enum: ['Admin', 'Teacher'] },
  rejectedAt: Date,
  rejectionReason: String,
}, { timestamps: true });

leaveSchema.index({ schoolId: 1 });
leaveSchema.index({ schoolId: 1, applicant: 1, status: 1 });
leaveSchema.index({ schoolId: 1, startDate: 1, endDate: 1 });

export default mongoose.model('Leave', leaveSchema);
