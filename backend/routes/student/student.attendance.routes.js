// routes/student/student.attendance.routes.js - FIXED
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as attendanceController from '../../controllers/student/student.attendance.controller.js';

const router = Router();

console.log("🔧 Student attendance routes loading...");

router.use(requireAuth(['student']));

router.get('/', attendanceController.getMyAttendance);
router.get('/by-subject', attendanceController.getAttendanceBySubject); // ✅ FIXED: Removed duplicate

console.log("✅ Student attendance routes loaded");

export default router;
