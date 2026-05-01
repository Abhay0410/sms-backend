import mongoose from 'mongoose';

const inventoryIssueSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  quantity: { type: Number, required: true, min: 1 },
  issueDate: { type: Date, default: Date.now },
  returnDate: { type: Date },
  issuedToType: { 
    type: String, 
    enum: ['CLASS', 'USER', 'DEPARTMENT', 'ROOM'], 
    required: true 
  },
  issuedToRef: { type: mongoose.Schema.Types.ObjectId }, // Ref to Class, Student, Teacher, etc.
  status: { 
    type: String, 
    enum: ['ISSUED', 'CONSUMED', 'RETURNED', 'DAMAGED'], 
    required: true 
  },
  allocationDetails: { type: mongoose.Schema.Types.Mixed } // For dynamic data like Serial No, MAC Address, etc.
}, { timestamps: true });

inventoryIssueSchema.index({ schoolId: 1, status: 1 });
inventoryIssueSchema.index({ schoolId: 1, issuedToType: 1, issuedToRef: 1 });

const InventoryIssue = mongoose.models.InventoryIssue || mongoose.model('InventoryIssue', inventoryIssueSchema);
export default InventoryIssue;