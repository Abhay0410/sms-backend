import express from 'express';
import { getUnassignedAdmissions, bulkEnrollStudents } from '../../controllers/admin/admin.enrollment.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = express.Router();

router.use(requireAuth(['admin']));

router.get('/unassigned', getUnassignedAdmissions);
router.post('/bulk-enroll', bulkEnrollStudents);

export default router;