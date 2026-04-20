import mongoose from 'mongoose';

const fuelLogSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  date: { type: Date, required: true, default: Date.now },
  quantityLiters: { type: Number, required: true, min: 0.1 },
  totalCost: { type: Number, required: true, min: 0 },
  odometerReading: { type: Number, required: true, min: 0 },
  receiptNumber: { type: String, trim: true },
  receiptImage: { type: String }, // URL if you want to store uploads
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

const FuelLog = mongoose.models.FuelLog || mongoose.model('FuelLog', fuelLogSchema);
export default FuelLog;