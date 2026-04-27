import mongoose from 'mongoose';
import Expense from '../../models/Expense.js';
import ExpenseCategory from '../../models/ExpenseCategory.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// ==============================================
// 1. EXPENSE CATEGORY MANAGEMENT
// ==============================================

export const addExpenseCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const schoolId = req.schoolId;

  const existing = await ExpenseCategory.findOne({ schoolId, name: new RegExp(`^${name}$`, 'i') });
  if (existing) {
    throw new ValidationError(`Expense category '${name}' already exists.`);
  }

  const category = await ExpenseCategory.create({
    schoolId,
    name,
    description,
    isSystemGenerated: false
  });

  return successResponse(res, "Expense category created successfully", category, 201);
});

export const getExpenseCategories = asyncHandler(async (req, res) => {
  const categories = await ExpenseCategory.find({ schoolId: req.schoolId }).sort({ name: 1 });
  return successResponse(res, "Expense categories retrieved successfully", categories);
});

// ==============================================
// 2. EXPENSE LEDGER MANAGEMENT
// ==============================================

export const addManualExpense = asyncHandler(async (req, res) => {
  const { categoryId, category, amount, date, paymentMode, description } = req.body;
  const schoolId = req.schoolId;

  const resolvedCategoryId = categoryId || category;

  if (!resolvedCategoryId || !amount) {
    throw new ValidationError("Category and amount are required.");
  }

  const categoryDoc = await ExpenseCategory.findOne({ _id: resolvedCategoryId, schoolId });
  if (!categoryDoc) throw new NotFoundError("Expense Category");

  const expense = await Expense.create({
    schoolId,
    category: resolvedCategoryId,
    amount,
    date: date || new Date(),
    paymentMode: paymentMode || 'CASH',
    source: 'MANUAL',
    description
  });

  return successResponse(res, "Expense added successfully", expense, 201);
});

export const getExpenses = asyncHandler(async (req, res) => {
  const { categoryId, source, startDate, endDate, month, year } = req.query;
  const filter = { schoolId: req.schoolId };

  if (categoryId) filter.category = categoryId;
  if (source) filter.source = source;
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    filter.date = { $gte: start, $lte: end };
  } else if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    filter.date = { $gte: start, $lte: end };
  }

  const expenses = await Expense.find(filter)
    .populate('category', 'name isSystemGenerated')
    .sort({ date: -1 });

  return successResponse(res, "Expenses retrieved successfully", expenses);
});

// ==============================================
// 3. FINANCIAL REPORTING & DASHBOARDS
// ==============================================

export const getFinancialSummary = asyncHandler(async (req, res) => {
  const schoolId = new mongoose.Types.ObjectId(req.schoolId);
  const { month, year, startDate, endDate } = req.query;

  const matchStage = { schoolId };
  
  // Prioritize exact date range if provided (allows filtering by specific day, week, month, or year)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    matchStage.date = {
      $gte: start,
      $lte: end
    };
  } else if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    matchStage.date = { $gte: start, $lte: end };
  }

  const summary = await Expense.aggregate([
    { $match: matchStage },
    {
      $facet: {
        total: [ { $group: { _id: null, amount: { $sum: "$amount" } } } ],
        bySource: [ { $group: { _id: "$source", amount: { $sum: "$amount" } } } ],
        byCategory: [
          { $lookup: { from: "expensecategories", localField: "category", foreignField: "_id", as: "cat" } },
          { $unwind: "$cat" },
          { $group: { _id: "$cat.name", amount: { $sum: "$amount" } } }
        ],
        // Group expenses by specific dates to build a time-series chart (daily breakdown)
        timeline: [
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              amount: { $sum: "$amount" }
            }
          },
          { $sort: { _id: 1 } }
        ]
      }
    }
  ]);

  const result = {
    totalExpenditure: summary[0].total[0]?.amount || 0, // Explicitly named for the new requested field
    totalExpense: summary[0].total[0]?.amount || 0, // Kept for backwards compatibility with existing UI
    bySource: summary[0].bySource.map(s => ({ source: s._id, amount: s.amount, name: s._id, value: s.amount })),
    byCategory: summary[0].byCategory.map(c => ({ category: c._id, amount: c.amount, name: c._id, value: c.amount })),
    timeline: summary[0].timeline.map(t => ({ date: t._id, amount: t.amount }))
  };

  return successResponse(res, "Financial summary retrieved", result);
});

export const deleteManualExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schoolId = req.schoolId;

  const expense = await Expense.findOne({ _id: id, schoolId });
  if (!expense) throw new NotFoundError("Expense");

  if (expense.source !== 'MANUAL') {
    throw new ValidationError("Only MANUAL expenses can be deleted directly. System-generated expenses must be deleted from their source modules.");
  }

  await Expense.deleteOne({ _id: id });
  return successResponse(res, "Expense deleted successfully");
});

export default {
  addExpenseCategory,
  getExpenseCategories,
  addManualExpense,
  getExpenses,
  getFinancialSummary,
  deleteManualExpense
};