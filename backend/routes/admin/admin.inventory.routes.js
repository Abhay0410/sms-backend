import express from 'express';
import {
  addInventoryItem,
  getInventoryItems,
  purchaseInventoryItem,
  getPurchases,
  issueItem,
  getIssues,
  updateIssueStatus,
  getConsumptionReport
} from '../../controllers/admin/admin.inventory.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = express.Router();

// Protect all routes
router.use(requireAuth(['admin']));

// --- Master Items Management ---
router.post('/items', addInventoryItem);
router.get('/items', getInventoryItems);

// --- Purchases (Stock In) ---
router.post('/purchases', purchaseInventoryItem);
router.get('/purchases', getPurchases);

// --- Reporting ---
router.get('/reports/consumption', getConsumptionReport);

// --- Allocation & Issues (Stock Out & Returns) ---
router.post('/issues', issueItem);
router.get('/issues', getIssues);
router.patch('/issues/:issueId/status', updateIssueStatus);

export default router;