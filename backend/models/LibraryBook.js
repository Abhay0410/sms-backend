import mongoose from 'mongoose';

const libraryBookSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  title: { type: String, required: true, trim: true },
  author: { type: String, required: true },
  isbn: { type: String }, 
  serialCode: { type: String, required: true }, // Unique code for every physical copy
  category: { type: String, enum: ['ACADEMIC', 'FICTION', 'REFERENCE', 'OTHERS'], default: 'ACADEMIC' },
  subject: { type: String },
  rackNumber: { type: String }, // Physical location in library
  price: { type: Number },
  status: { 
    type: String, 
    enum: ['AVAILABLE', 'ISSUED', 'LOST', 'DAMAGED', 'RESERVED'], 
    default: 'AVAILABLE' 
  }
}, { timestamps: true });

// Har school ke liye serial code unique hona chahiye
libraryBookSchema.index({ schoolId: 1, serialCode: 1 }, { unique: true });

export default mongoose.model('LibraryBook', libraryBookSchema);