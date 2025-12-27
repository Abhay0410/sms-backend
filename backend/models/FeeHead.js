import mongoose from 'mongoose';

const feeHeadSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  name: { type: String, required: true }, // "Tuition Fee", "Transport"
  type: { 
    type: String, 
    enum: ['RECURRING', 'ONE_TIME', 'FINE'], 
    default: 'RECURRING' 
  },
  description: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Prevent duplicate names per school
feeHeadSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export default mongoose.model('FeeHead', feeHeadSchema);
