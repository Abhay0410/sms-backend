// routes/student/student.fee.routes.js - FIXED
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as feeController from '../../controllers/student/student.fee.controller.js';

const router = Router();

console.log("🔧 Student fee routes loading...");

router.use(requireAuth(['student']));

router.get('/status', feeController.getFeeStatus);
router.get('/history', feeController.getPaymentHistory);
router.get('/:feePaymentId/payment/:paymentId/receipt', feeController.getFeeReceipt);
router.get('/:feePaymentId/payment/:paymentId/download', feeController.downloadFeeReceipt);

console.log("✅ Student fee routes loaded");

export default router;
