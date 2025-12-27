// routes/admin/admin.fee.routes.js
import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import feeController from '../../controllers/admin/admin.fee.controller.js';

const router = express.Router();

// Auth
router.use(requireAuth(['admin']));

// 1. MASTER DATA (Fee Heads)
router.post('/head', feeController.createFeeHead);
router.get('/head', feeController.getFeeHeads);

// 2. FEE STRUCTURE (Rules per Class)
router.get('/class-fees', feeController.getClassFeeStructures);
router.put('/set-class-fee', feeController.setClassFeeStructure);

// 3. STUDENT FEE ASSIGNMENT (Generation)
router.post('/assign-structure', feeController.assignFeeStructureToStudent);
router.post('/assign-structure/bulk', feeController.createBulkFeeStructureFromClass);

// 4. PAYMENTS & TRANSACTIONS
router.post('/pay', feeController.recordPayment);

// 5. RECEIPTS & PDF
router.get('/receipt/:paymentId/download', feeController.downloadReceipt);

// 6. DASHBOARD & REPORTS
router.get('/statistics', feeController.getFeeStatistics);
router.get('/defaulters', feeController.getFeeDefaulters);

router.get('/students-with-fees', feeController.getStudentsWithFees);
router.get('/payments', feeController.getAllPayments);

console.log('✅ Admin fee routes loaded');

export default router;
