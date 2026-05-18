import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const enrollmentSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  className: { type: String, required: true },
  section: { type: String, required: true },
  academicYear: { type: String, required: true },
  rollNumber: { type: Number },
  status: { 
    type: String, 
    enum: ['ACTIVE', 'PROMOTED', 'DROPPED', 'REPEATED'], 
    default: 'ACTIVE' 
  },
  enrollmentDate: { type: Date, default: Date.now }
}, { timestamps: true });

enrollmentSchema.plugin(mongoosePaginate);
enrollmentSchema.index({ schoolId: 1, student: 1, academicYear: 1 }, { unique: true });
enrollmentSchema.index({ schoolId: 1, class: 1, section: 1, academicYear: 1 });

export default mongoose.model('Enrollment', enrollmentSchema);