// routes/parent/parent.attendance.routes.js - PRODUCTION READY
import { Router } from 'express';  // ✅ Consistent import
import { requireAuth } from '../../middleware/auth.js';
import * as attendanceController from '../../controllers/parent/parent.attendance.controller.js';

const router = Router();

console.log("🔧 Parent attendance routes loading...");

router.use(requireAuth(['parent']));

router.get('/:childId', attendanceController.getChildAttendance);

console.log("✅ Parent attendance routes loaded - 1 route");

export default router;
