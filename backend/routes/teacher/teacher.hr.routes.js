import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { 
    getMyTodayAttendance,
    markAttendance, 
    markCheckOut, 
    applyLeave, 
    getMyLeaves 
} from "../../controllers/teacher/teacher.hr.controller.js";

const router = Router();

// Self Attendance
router.get("/attendance/today", requireAuth(["teacher"]), getMyTodayAttendance);
router.post("/attendance/in", requireAuth(["teacher"]), markAttendance);
router.post("/attendance/out", requireAuth(["teacher"]), markCheckOut);

// Leave Applications
router.post("/leaves/apply", requireAuth(["teacher"]), applyLeave);
router.get("/leaves/my", requireAuth(["teacher"]), getMyLeaves);

// Payroll Details
router.get("/payroll/my", requireAuth(["teacher"]), (req, res) => {
    // Logic to fetch personal salary history
});

export default router;