import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as resultController from '../../controllers/admin/admin.result.controller.js';

const router = express.Router();
router.use(requireAuth(['admin']));

// ✅ Frontend routes
router.get('/', resultController.getAllResults);
router.get('/statistics', resultController.getResultStatistics);
router.get('/:id', resultController.getResultById);
router.get('/:resultId/download', resultController.downloadResult);
router.put('/:resultId/approve', resultController.approveResult);
router.put('/:resultId/unapprove', resultController.unapproveResult);
router.put('/:resultId/publish', resultController.publishResult);
router.put('/:resultId/unpublish', resultController.unpublishResult);
// ✅ FIXED: Correct bulk route names
router.put('/bulk-approve', resultController.bulkApproveResults);
router.put('/bulk-publish', resultController.bulkPublishResults);

export default router;
