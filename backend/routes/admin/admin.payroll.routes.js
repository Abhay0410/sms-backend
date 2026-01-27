import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { generateMonthlyPayroll } from "../../controllers/admin/admin.payroll.controller.js";
import { getMonthlyPayroll, markPayrollPaid, getTeacherPayrollHistory, deleteDraftPayroll ,updateTeacherSalary, updatePayroll } from "../../controllers/admin/admin.payroll.controller.js";


const router = Router();




// Payroll Engine
// router.post("/payroll/generate", requireAuth(["admin"]), generateMonthlyPayroll);
router.post('/payroll/generate', requireAuth(["admin"]), generateMonthlyPayroll);
router.get('/payroll', requireAuth(["admin"]), getMonthlyPayroll);
router.patch('/payroll/:payrollId/pay', requireAuth(["admin"]), markPayrollPaid);
router.get('/teacher/:teacherId',requireAuth(["admin"]), getTeacherPayrollHistory);
router.delete('/delete/payroll/:payrollId', requireAuth(["admin"]), deleteDraftPayroll);
router.patch(
  "/teachers/:teacherId/salary",
  requireAuth(["admin"]),
  updateTeacherSalary
);

router.patch(
  "/update/:id",
  requireAuth(["admin"]),
  updatePayroll
);

export default router;