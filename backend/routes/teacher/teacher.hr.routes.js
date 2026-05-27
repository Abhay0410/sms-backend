import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { 
    getMyTodayAttendance,
    markAttendance, 
    markCheckOut, 
    applyLeave, 
    getMyLeaves,
    getRecentAttendance,
    getAttendanceStats
} from "../../controllers/teacher/teacher.hr.controller.js";
import { getMySalaryHistory } from "../../controllers/admin/admin.payroll.controller.js"; 
import { requireModule } from "../../middleware/featureGate.js";

const router = Router();

// Authenticate FIRST to set req.schoolId context
router.use(requireAuth(["teacher", "admin"]));
// Protect all teacher HR routes based on the school's SaaS plan
router.use(requireModule("HR"));

// Self Attendance
router.get("/attendance/today", getMyTodayAttendance);
router.get("/payroll/my", getMySalaryHistory);
// Attendance Operations
router.post("/attendance/in", markAttendance);
router.post("/attendance/out", markCheckOut);
router.get("/attendance/recent", getRecentAttendance);
router.get("/attendance/stats", getAttendanceStats);
// Leave Applications
router.post("/leaves/apply", applyLeave);
router.get("/leaves/my", getMyLeaves);


export default router;