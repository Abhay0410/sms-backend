import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  registrationNumber: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1 },
  type: { type: String, enum: ['Bus', 'Van', 'Car'], required: true },
  make: { type: String, trim: true },
  model: { type: String, trim: true },
  year: { type: Number },
  status: { type: String, enum: ['Active', 'Maintenance', 'Retired'], default: 'Active' }
}, { timestamps: true });

// Ensure unique vehicle registration numbers per school
vehicleSchema.index({ schoolId: 1, registrationNumber: 1 }, { unique: true });

const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;