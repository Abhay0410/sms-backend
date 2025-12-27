//models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER', 'ALERT'], 
    default: 'INFO' 
  },
  category: { 
    type: String, 
    enum: ['ACADEMIC', 'FEE', 'ATTENDANCE', 'RESULT', 'EXAM', 'EVENT', 'SYSTEM', 'GENERAL'], 
    required: true 
  },
  
  // Recipient
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'recipientModel', 
    required: true 
  },
  recipientModel: { 
    type: String, 
    enum: ['Student', 'Teacher', 'Parent', 'Admin'], 
    required: true 
  },
  
  // Related Data
  relatedTo: {
    model: { type: String, enum: ['Student', 'Teacher', 'Class', 'FeePayment', 'Result', 'Attendance'] },
    id: mongoose.Schema.Types.ObjectId
  },
  
  link: String,
  isRead: { type: Boolean, default: false },
  readAt: Date,
  isDeleted: { type: Boolean, default: false },
  
  // Sender
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'senderModel' 
  },
  senderModel: { 
    type: String, 
    enum: ['Admin', 'Teacher', 'System'] 
  },
  priority: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH'], 
    default: 'MEDIUM' 
  },
  expiryDate: Date,
}, { timestamps: true });

notificationSchema.index({ schoolId: 1 });
notificationSchema.index({ schoolId: 1, recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ schoolId: 1, recipientModel: 1, isDeleted: 1 });

export default mongoose.model('Notification', notificationSchema);
