import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { 
    getAllStaffAttendance, 
    processLeaveRequest, 
    getMonthlyAttendanceReport,
    updateStaffAttendance,getAllLeaves
} from "../../controllers/admin/admin.hr.controller.js";
import { generateMonthlyPayroll } from "../../controllers/admin/admin.payroll.controller.js";

const router = Router();

// Attendance Monitoring
router.get("/attendance", requireAuth(["admin"]), getAllStaffAttendance);
router.put("/attendance/:attendanceId", requireAuth(["admin"]), updateStaffAttendance);
router.get("/attendance/report", requireAuth(["admin"]), getMonthlyAttendanceReport);

// Leave Management
router.get("/leaves", requireAuth(["admin"]), getAllLeaves); 

router.put("/leaves/:leaveId/process", requireAuth(["admin"]), processLeaveRequest);

// Payroll Engine
router.post("/payroll/generate", requireAuth(["admin"]), generateMonthlyPayroll);

export default router;