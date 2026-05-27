import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { 
    getAllStaffAttendance, 
    processLeaveRequest, 
    getMonthlyAttendanceReport,
    updateStaffAttendance,getAllLeaves
} from "../../controllers/admin/admin.hr.controller.js";
import { requireModule } from "../../middleware/featureGate.js";


const router = Router();

// Authenticate FIRST to set req.schoolId
router.use(requireAuth(["admin"]));
router.use(requireModule("HR"));

// Attendance Monitoring
router.get("/attendance", getAllStaffAttendance);
router.put("/attendance/:attendanceId", updateStaffAttendance);
router.get("/attendance/report", getMonthlyAttendanceReport);

// Leave Management
router.get("/leaves", getAllLeaves); 

router.put("/leaves/:leaveId/process", processLeaveRequest);



export default router;