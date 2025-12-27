import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  eventType: { 
    type: String, 
    enum: ['ACADEMIC', 'SPORTS', 'CULTURAL', 'HOLIDAY', 'MEETING', 'EXAM', 'WORKSHOP', 'COMPETITION', 'OTHER'], 
    required: true 
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  startTime: String,
  endTime: String,
  venue: String,
  
  targetAudience: {
    allStudents: { type: Boolean, default: false },
    specificClasses: [{
      class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
      sections: [String]
    }],
    teachers: { type: Boolean, default: false },
    parents: { type: Boolean, default: false }
  },
  
  organizer: String,
  coordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  registrationRequired: { type: Boolean, default: false },
  registrationDeadline: Date,
  maxParticipants: Number,
  
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, refPath: 'participants.userModel' },
    userModel: { type: String, enum: ['Student', 'Teacher'] },
    registeredAt: { type: Date, default: Date.now }
  }],
  
  images: [String],
  documents: [String],
  status: { 
    type: String, 
    enum: ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'POSTPONED'], 
    default: 'SCHEDULED' 
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

eventSchema.index({ schoolId: 1 });
eventSchema.index({ schoolId: 1, startDate: 1, status: 1 });

export default mongoose.model('Event', eventSchema);
