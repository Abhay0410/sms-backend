import mongoose from 'mongoose';

const transportStaffSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Driver', 'Helper'], required: true },
  phone: { type: String, required: true, trim: true },
  licenseNumber: { type: String, trim: true },
  licenseExpiry: { type: Date },
  address: { type: String, trim: true },
  assignedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }
}, { timestamps: true });

const TransportStaff = mongoose.models.TransportStaff || mongoose.model('TransportStaff', transportStaffSchema);
export default TransportStaff;