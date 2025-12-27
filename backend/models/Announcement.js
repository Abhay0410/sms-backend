import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true,
    // index: true 
  },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  content: { type: String, required: true, maxlength: 5000 },
  type: { type: String, enum: ['GENERAL', 'ACADEMIC', 'EVENT', 'HOLIDAY', 'URGENT', 'EXAM', 'FEE', 'SPORTS'], default: 'GENERAL' },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
  
  // Target Audience Configuration
  targetAudience: {
    students: { type: Boolean, default: false },
    teachers: { type: Boolean, default: false },
    parents: { type: Boolean, default: false },
    specificClasses: [{
      class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
      className: String,
      allSections: { type: Boolean, default: true },
      sections: [String]
    }]
  },
  
  attachments: [{
    fileName: String,
    fileUrl: String,
    publicId: String,
    fileType: { type: String, enum: ['image', 'document', 'video', 'raw'] },
    fileSize: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  publishDate: { type: Date, default: Date.now },
  expiryDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value > this.publishDate;
      },
      message: 'Expiry date must be after publish date'
    }
  },
  isPinned: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  
  // Creator info
  createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel', required: true },
  createdByModel: { type: String, enum: ['Admin', 'Teacher'], required: true },
  createdByName: { type: String, required: true },
  
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel' },
  lastEditedAt: { type: Date },
  
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, refPath: 'readByModel' },
    readByModel: { type: String, enum: ['Student', 'Teacher', 'Parent'] },
    readAt: { type: Date, default: Date.now }
  }],
  
  viewCount: { type: Number, default: 0 }
}, { timestamps: true });

announcementSchema.index({ schoolId: 1 });
announcementSchema.index({ schoolId: 1, publishDate: -1, isPinned: -1 });
announcementSchema.index({ 'targetAudience.specificClasses.class': 1 });
announcementSchema.index({ isActive: 1, expiryDate: 1 });
announcementSchema.index({ type: 1, priority: 1 });
announcementSchema.index({ createdBy: 1, createdAt: -1 });

announcementSchema.virtual('isExpired').get(function() {
  return this.expiryDate && this.expiryDate < new Date();
});

announcementSchema.virtual('readPercentage').get(function() {
  return this.readBy.length;
});

announcementSchema.methods.isVisibleTo = function(userRole, userClass, userSection) {
  if (!this.isActive) return false;
  if (this.isExpired) return false;
  
  const audience = this.targetAudience;
  
  if (userRole === 'student' && !audience.students) return false;
  if (userRole === 'teacher' && !audience.teachers) return false;
  if (userRole === 'parent' && !audience.parents) return false;
  
  if (audience.specificClasses && audience.specificClasses.length > 0) {
    return audience.specificClasses.some(sc => {
      if (sc.className !== userClass) return false;
      if (sc.allSections) return true;
      return sc.sections.includes(userSection);
    });
  }
  
  return true;
};

announcementSchema.statics.getActive = function(filters = {}) {
  return this.find({
    isActive: true,
    $or: [
      { expiryDate: { $exists: false } },
      { expiryDate: { $gt: new Date() } }
    ],
    ...filters
  }).sort({ isPinned: -1, publishDate: -1 });
};

export default mongoose.model('Announcement', announcementSchema);
