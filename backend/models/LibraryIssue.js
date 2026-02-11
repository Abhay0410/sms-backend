import mongoose from 'mongoose';

const issueRecordSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryBook', required: true },
  
  // User context (Can be Student or Teacher)
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userType: { type: String, enum: ['student', 'teacher'], required: true },
  userName: String, // Optimization for quick view
  
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  returnDate: { type: Date },
  
  status: { type: String, enum: ['ISSUED', 'RETURNED', 'OVERDUE', 'LOST'], default: 'ISSUED' },
  librarianNote: String
}, { timestamps: true });

export default mongoose.model('LibraryIssue', issueRecordSchema);