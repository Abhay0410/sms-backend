// routes/parent/parent.fee.routes.js
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as feeController from '../../controllers/parent/parent.fee.controller.js';

const router = Router();

router.use(requireAuth(['parent']));

// LIST all children with summary
router.get('/', feeController.getAllChildrenFeeStatus);  // matches ALL_CHILDREN

// Single child
router.get('/:childId/status', feeController.getChildFeeStatus);      // CHILD_STATUS
router.get('/:childId/history', feeController.getChildPaymentHistory); // CHILD_HISTORY

// Receipts (feePaymentId + paymentId)
router.get('/receipt/:feePaymentId/:paymentId', feeController.getFeeReceipt);
router.get('/receipt/:feePaymentId/:paymentId/download', feeController.downloadFeeReceipt);

export default router;
