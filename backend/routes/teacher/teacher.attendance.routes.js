import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as attendanceController from '../../controllers/teacher/teacher.attendance.controller.js';

const router = express.Router();

router.use(requireAuth(['teacher']));

router.post('/', attendanceController.markAttendance);
router.get('/classes', attendanceController.getTeacherClasses);
router.get('/students', attendanceController.getClassStudents);
router.get('/class', attendanceController.getAttendanceByClass);
router.get('/date', attendanceController.getAttendanceByDate);
router.put('/:attendanceId', attendanceController.updateAttendance);
router.get('/student/:studentId/summary', attendanceController.getStudentAttendanceSummary);

export default router;
