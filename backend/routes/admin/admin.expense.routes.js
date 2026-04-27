import express from 'express';
import {
  addExpenseCategory,
  getExpenseCategories,
  addManualExpense,
  getExpenses,
  getFinancialSummary,
  deleteManualExpense
} from '../../controllers/admin/admin.expense.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = express.Router();

// Protect all routes (assuming 'admin' handles these operations)
router.use(requireAuth(['admin']));

// --- Expense Categories ---
router.post('/categories', addExpenseCategory);
router.get('/categories', getExpenseCategories);

// --- Financial Reporting ---
router.get('/summary', getFinancialSummary);

// --- General Expense Ledger ---
router.post('/', addManualExpense);
router.get('/', getExpenses);
router.delete('/:id', deleteManualExpense);

export default router;