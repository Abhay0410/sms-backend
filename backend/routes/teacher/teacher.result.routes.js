import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as resultController from '../../controllers/teacher/teacher.result.controller.js';

const router = express.Router();

router.use(requireAuth(['teacher']));

router.get('/sections', resultController.getSectionsForResult);
router.get('/students', resultController.getStudentsForResult);
router.post('/create', resultController.createResult);
router.get('/my-results', resultController.getResultsByTeacher);
router.get('/approved', resultController.getApprovedResults);
router.get('/:resultId/download', resultController.downloadResult);
router.get('/:resultId', resultController.getResultById);
router.put('/:resultId', resultController.updateResult);
router.delete('/:resultId', resultController.deleteResult);

export default router;
