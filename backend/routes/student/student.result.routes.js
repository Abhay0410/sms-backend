// routes/student/student.result.routes.js - FIXED
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as resultController from '../../controllers/student/student.result.controller.js';

const router = Router();

console.log("🔧 Student result routes loading...");

router.use(requireAuth(['student']));

router.get('/', resultController.getMyResults);
router.get('/statistics', resultController.getMyResultStatistics);
router.get('/:resultId', resultController.getResultById);
router.get('/:resultId/view', resultController.viewResult);
router.get('/:resultId/download', resultController.downloadResult);

console.log("✅ Student result routes loaded");

export default router;
