import mongoose from 'mongoose';

const inventoryPurchaseSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true },
  vendor: { type: String },
  purchaseDate: { type: Date, default: Date.now },
  receiptNumber: { type: String },
  expenseRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' } // Links to the Expense Ledger
}, { timestamps: true });

inventoryPurchaseSchema.index({ schoolId: 1, purchaseDate: -1 });

const InventoryPurchase = mongoose.models.InventoryPurchase || mongoose.model('InventoryPurchase', inventoryPurchaseSchema);
export default InventoryPurchase;