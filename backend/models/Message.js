// models/Message.js
import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  userType: { type: String, enum: ['teacher', 'student', 'parent'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'participants.userTypeRef' },
  // refPath ke liye helper field
  userTypeRef: {
    type: String,
    required: true,
    enum: ['Teacher', 'Student', 'Parent'],
  },
});

const messageItemSchema = new mongoose.Schema({
  senderType: { type: String, enum: ['teacher', 'student', 'parent'], required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  content: { type: String, required: true },
  attachments: [String],
  createdAt: { type: Date, default: Date.now },
});

const messageThreadSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },

  participants: [participantSchema], // all teachers/students/parents in this conversation

  title: String,                      // optional: e.g. "Class 6A Homework"
  context: {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    sectionName: String,             // e.g. "A"
  },

  messages: [messageItemSchema],     // threaded messages

  createdByType: { type: String, enum: ['teacher', 'student', 'parent'], required: true },
  createdById: { type: mongoose.Schema.Types.ObjectId, required: true },

  isGroup: { type: Boolean, default: false },

  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

messageThreadSchema.index({ schoolId: 1, 'participants.userId': 1 });

export default mongoose.model('Message', messageThreadSchema);
