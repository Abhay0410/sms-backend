import mongoose from 'mongoose';

const tripLogSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportStaff', required: true },
  date: { type: Date, required: true, default: Date.now },
  startOdometer: { type: Number, required: true, min: 0 },
  endOdometer: { type: Number, required: true, min: 0 },
  routeDescription: { type: String, trim: true },
  notes: { type: String, trim: true }
}, { timestamps: true });

// Prevent invalid odometer inputs logically
tripLogSchema.pre('save', function(next) {
  if (this.endOdometer < this.startOdometer) {
    next(new Error('End odometer reading cannot be less than the start odometer reading.'));
  } else {
    next();
  }
});

const TripLog = mongoose.models.TripLog || mongoose.model('TripLog', tripLogSchema);
export default TripLog;