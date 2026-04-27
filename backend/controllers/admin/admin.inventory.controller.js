import mongoose from 'mongoose';
import InventoryItem from '../../models/InventoryItem.js';
import InventoryPurchase from '../../models/InventoryPurchase.js';
import InventoryIssue from '../../models/InventoryIssue.js';
import Expense from '../../models/Expense.js';
import ExpenseCategory from '../../models/ExpenseCategory.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// ==============================================
// 1. INVENTORY ITEM MASTER MANAGEMENT
// ==============================================

export const addInventoryItem = asyncHandler(async (req, res) => {
  const { itemName, category, itemType, unit, minimumStockLevel } = req.body;
  const schoolId = req.schoolId;

  const existingItem = await InventoryItem.findOne({ 
    schoolId, 
    itemName: new RegExp(`^${itemName}$`, 'i') 
  });
  
  if (existingItem) {
    throw new ValidationError(`Item '${itemName}' already exists in inventory.`);
  }

  const item = await InventoryItem.create({
    schoolId,
    itemName,
    category,
    itemType, // 'ASSET' or 'CONSUMABLE'
    unit,
    minimumStockLevel: minimumStockLevel || 5
  });

  return successResponse(res, "Inventory item created successfully", item, 201);
});

export const getInventoryItems = asyncHandler(async (req, res) => {
  const { category, itemType, inStorageOnly } = req.query;
  const filter = { schoolId: req.schoolId };

  if (category) filter.category = category;
  if (itemType) filter.itemType = itemType;
  
  // Requirement: Only show items currently available in storage
  if (inStorageOnly === 'true') {
    filter.inStorage = { $gt: 0 }; 
  }

  const items = await InventoryItem.find(filter).sort({ itemName: 1 });
  return successResponse(res, "Inventory items retrieved successfully", items);
});

// ==============================================
// 2. PURCHASING STOCK (SYNC WITH EXPENSE)
// ==============================================

export const purchaseInventoryItem = asyncHandler(async (req, res) => {
  let { itemId, quantity, unitPrice, vendor, receiptNumber, purchaseDate } = req.body;
  const schoolId = req.schoolId;

  quantity = Number(quantity);
  unitPrice = Number(unitPrice);

  if (!quantity || !unitPrice || quantity <= 0 || unitPrice < 0) {
    throw new ValidationError("Valid quantity and unit price are required.");
  }

  const item = await InventoryItem.findOne({ _id: itemId, schoolId });
  if (!item) throw new NotFoundError("Inventory Item");

  const totalAmount = quantity * unitPrice;

  // 1. Create Purchase Record
  const purchase = await InventoryPurchase.create({
    schoolId,
    item: item._id,
    quantity,
    unitPrice,
    totalAmount,
    vendor,
    receiptNumber,
    purchaseDate: purchaseDate || new Date()
  });

  // 2. Sync with Financial Ledger (Expense Module)
  let expCategory = await ExpenseCategory.findOne({ schoolId, name: 'Inventory Purchases', isSystemGenerated: true });
  if (!expCategory) {
    expCategory = await ExpenseCategory.create({ 
      schoolId, 
      name: 'Inventory Purchases', 
      description: 'System generated category for inventory stock purchases', 
      isSystemGenerated: true 
    });
  }

  const expense = await Expense.create({
    schoolId,
    category: expCategory._id,
    amount: totalAmount,
    date: purchase.purchaseDate,
    paymentMode: 'CASH', // Admin can edit this later in the expense module if needed
    source: 'INVENTORY_PURCHASE',
    referenceId: purchase._id,
    description: `Purchased ${quantity} ${item.unit} of ${item.itemName} from ${vendor || 'Unknown Vendor'}`
  });

  // Link the expense back to the purchase
  purchase.expenseRef = expense._id;
  await purchase.save();

  // 3. Update Master Stock
  item.inStorage += quantity;
  await item.save();

  return successResponse(res, "Stock purchased and expense logged successfully", { purchase, currentStock: item.inStorage }, 201);
});

export const getPurchases = asyncHandler(async (req, res) => {
  const purchases = await InventoryPurchase.find({ schoolId: req.schoolId })
    .populate('item', 'itemName category itemType unit')
    .sort({ purchaseDate: -1 });
    
  return successResponse(res, "Purchase history retrieved", purchases);
});

// ==============================================
// 3. ALLOCATION ENGINE (ISSUING ITEMS)
// ==============================================

export const issueItem = asyncHandler(async (req, res) => {
  let { itemId, quantity, issuedToType, issuedToRef, allocationDetails } = req.body;
  const schoolId = req.schoolId;

  quantity = Number(quantity);

  if (!quantity || quantity <= 0) throw new ValidationError("Valid quantity required.");

  const item = await InventoryItem.findOne({ _id: itemId, schoolId });
  if (!item) throw new NotFoundError("Inventory Item");

  if (item.inStorage < quantity) {
    throw new ValidationError(`Insufficient stock. Only ${item.inStorage} ${item.unit} available.`);
  }

  let status;
  
  // LOGIC: Consumable vs Asset
  if (item.itemType === 'CONSUMABLE') {
    // Consumables disappear from storage entirely.
    item.inStorage -= quantity;
    status = 'CONSUMED';
  } else if (item.itemType === 'ASSET') {
    // Assets move from storage to 'inUse'.
    item.inStorage -= quantity;
    item.inUse += quantity;
    status = 'ISSUED';
  }

  await item.save();

  // Handle non-ObjectId strings in issuedToRef (like "computer lab 1")
  let validIssuedToRef = issuedToRef;
  let finalAllocationDetails = allocationDetails ? { ...allocationDetails } : {};
  
  if (issuedToRef && !mongoose.Types.ObjectId.isValid(issuedToRef)) {
    finalAllocationDetails.customLocation = issuedToRef;
    validIssuedToRef = undefined; // Unset it to prevent CastError
  }

  const issueRecord = await InventoryIssue.create({
    schoolId,
    item: item._id,
    quantity,
    issuedToType, // 'CLASS', 'USER', 'DEPARTMENT', 'ROOM'
    issuedToRef: validIssuedToRef,
    status,
    allocationDetails: finalAllocationDetails // Dynamic fields (e.g., Serial numbers, specs)
  });

  // Map it back immediately for the frontend response
  const responseRecord = issueRecord.toObject();
  responseRecord.issuedToRef = finalAllocationDetails.customLocation || responseRecord.issuedToRef;

  return successResponse(res, `Item successfully ${status.toLowerCase()}`, responseRecord, 201);
});

export const getIssues = asyncHandler(async (req, res) => {
  const { status, issuedToType, startDate, endDate, month, year } = req.query;
  const filter = { schoolId: req.schoolId };

  if (status) filter.status = status;
  if (issuedToType) filter.issuedToType = issuedToType;

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.issueDate = { $gte: start, $lte: end };
  } else if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    filter.issueDate = { $gte: start, $lte: end };
  }

  const issues = await InventoryIssue.find(filter)
    .populate('item', 'itemName category itemType unit')
    .sort({ issueDate: -1 })
    .lean(); // Use lean() to return plain JS objects

  // Format response so the frontend always sees a valid string for "Issued To"
  const formattedIssues = issues.map(issue => ({
    ...issue,
    issuedToRef: issue.allocationDetails?.customLocation || issue.issuedToRef || 'Unknown'
  }));

  return successResponse(res, "Issue logs retrieved successfully", formattedIssues);
});

// ==============================================
// 4. ASSET LIFECYCLE (RETURNS & DAMAGES)
// ==============================================

export const updateIssueStatus = asyncHandler(async (req, res) => {
  const { issueId } = req.params;
  const { newStatus, status } = req.body; 
  const schoolId = req.schoolId;

  // Handle both 'newStatus' and 'status' payloads, and normalize to uppercase
  const resolvedStatus = (newStatus || status || '').toUpperCase().trim();

  if (!['RETURNED', 'DAMAGED'].includes(resolvedStatus)) {
    throw new ValidationError("Status can only be updated to 'RETURNED' or 'DAMAGED'.");
  }

  const issueRecord = await InventoryIssue.findOne({ _id: issueId, schoolId }).populate('item');
  if (!issueRecord) throw new NotFoundError("Issue Record");

  if (issueRecord.status !== 'ISSUED') {
    throw new ValidationError(`Cannot update status. Item is already marked as ${issueRecord.status}.`);
  }

  const item = issueRecord.item;

  // Sanity check just in case
  if (item.itemType !== 'ASSET') {
    throw new ValidationError("Only ASSET items can be returned or marked as damaged.");
  }

  // Deduct from inUse
  item.inUse -= issueRecord.quantity;

  if (resolvedStatus === 'RETURNED') {
    item.inStorage += issueRecord.quantity;
    issueRecord.returnDate = new Date();
  } else if (resolvedStatus === 'DAMAGED') {
    item.damaged += issueRecord.quantity;
  }

  issueRecord.status = resolvedStatus;

  await Promise.all([item.save(), issueRecord.save()]);

  return successResponse(res, `Asset successfully marked as ${resolvedStatus}`, issueRecord);
});

// ==============================================
// 5. REPORTING & DASHBOARDS
// ==============================================

export const getConsumptionReport = asyncHandler(async (req, res) => {
  const schoolId = new mongoose.Types.ObjectId(req.schoolId);
  const { month, year, itemType, startDate, endDate } = req.query;

  const matchStage = { schoolId };
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    matchStage.issueDate = { $gte: start, $lte: end };
  } else if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    matchStage.issueDate = { $gte: start, $lte: end };
  }

  // Filter by item type (ASSET vs CONSUMABLE) if provided
  const itemMatchStage = itemType ? { "item.itemType": itemType } : {};

  const consumptionSummary = await InventoryIssue.aggregate([
    { $match: matchStage },
    { $lookup: { from: "inventoryitems", localField: "item", foreignField: "_id", as: "item" } },
    { $unwind: "$item" },
    { $match: itemMatchStage },
    { $group: {
        _id: { itemId: "$item._id", itemName: "$item.itemName", itemType: "$item.itemType", unit: "$item.unit" },
        totalIssued: { $sum: "$quantity" },
        timesIssued: { $sum: 1 }
    }},
    { $project: {
        _id: "$_id.itemName", 
        itemId: "$_id.itemId", 
        itemName: "$_id.itemName", 
        itemType: "$_id.itemType",
        unit: "$_id.unit", 
        totalIssued: 1, 
        timesIssued: 1,
        totalConsumed: "$totalIssued"
    }},
    { $sort: { totalIssued: -1 } }
  ]);

  return successResponse(res, "Consumption report retrieved", consumptionSummary);
});


export default {
  addInventoryItem,
  getInventoryItems,
  purchaseInventoryItem,
  getPurchases,
  issueItem,
  getIssues,
  updateIssueStatus,
  getConsumptionReport
};