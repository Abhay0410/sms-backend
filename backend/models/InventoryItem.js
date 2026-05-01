import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  itemName: { type: String, required: true },
  category: { type: String, required: true }, // e.g., 'IT Equipment', 'Furniture', 'Academic'
  itemType: { type: String, enum: ['ASSET', 'CONSUMABLE'], required: true },
  unit: { type: String, required: true }, // e.g., 'Pcs', 'Boxes', 'Liters'
  inStorage: { type: Number, default: 0 }, // Idle stock available to issue
  inUse: { type: Number, default: 0 }, // Allocated/Deployed stock
  damaged: { type: Number, default: 0 },
  minimumStockLevel: { type: Number, default: 5 } // Threshold for low stock alerts
}, { timestamps: true });

inventoryItemSchema.index({ schoolId: 1, itemName: 1 });

const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);
export default InventoryItem;