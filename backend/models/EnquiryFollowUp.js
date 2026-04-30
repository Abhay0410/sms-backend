import mongoose from 'mongoose';

const enquiryFollowUpSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'School'
  },
  enquiry: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Enquiry'
  },
  followedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  followUpDate: {
    type: Date,
    default: Date.now
  },
  nextActionDate: { type: Date },
  outcome: {
    type: String,
    enum: ['BUSY', 'CALL_LATER', 'INTERESTED', 'NOT_INTERESTED', 'VISIT_SCHEDULED']
  },
  conversationNotes: { type: String }
}, { timestamps: true });

export default mongoose.model('EnquiryFollowUp', enquiryFollowUpSchema);