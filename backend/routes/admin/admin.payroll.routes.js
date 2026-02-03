// routes/admin.payroll.routes.js
import { Router } from 'express';
import { 
  calculateAndSetSalary, 
  getAttendanceStats, 
  runMonthlyPayroll,
  getUnifiedStaffList,
  getPayrollSummary,
  getPayrollStructure,
  markPayrollPaid,
  getMonthlyPayroll,
  deleteDraftPayroll,
  updateTeacherSalary,
  updatePayroll,
  getTeacherPayrollHistory,
  getMySalaryHistory,
  generateMonthlyPayroll,
  getPayrollDetails,
  downloadSalarySlip,
  updateSchoolPayrollPolicy,
  getSchoolPayrollPolicy,
} from '../../controllers/admin/admin.payroll.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// 1. Specific Static Routes FIRST
router.get('/attendance-stats', requireAuth(['admin']), getAttendanceStats);
router.get('/staff-list', requireAuth(['admin']), getUnifiedStaffList);
router.get('/summary', requireAuth(['admin']), getPayrollSummary);

// 2. Generation Routes
// ✅ Ensure this matches what the Frontend is calling via the Constant
router.post('/run-payroll', requireAuth(['admin']), runMonthlyPayroll); 

// Standard bulk generate
router.post('/generate', requireAuth(['admin']), generateMonthlyPayroll);

// 3. Structure Routes
router.get('/policy', requireAuth(['admin']), getSchoolPayrollPolicy);
router.post('/policy', requireAuth(['admin']), updateSchoolPayrollPolicy);
router.post('/setup-salary', requireAuth(['admin']), calculateAndSetSalary);
router.post('/setup-structure', requireAuth(['admin']), calculateAndSetSalary);
router.get('/structure/:teacherId', requireAuth(['admin']), getPayrollStructure);
router.patch('/teachers/:teacherId/salary', requireAuth(['admin']), updateTeacherSalary);

// 4. Other Specific Routes
router.get('/teacher/:teacherId', requireAuth(['admin']), getTeacherPayrollHistory);
router.get('/slip-details/:slipId', requireAuth(['admin', 'teacher']), getPayrollDetails);
router.put('/mark-paid/:slipId', requireAuth(['admin']), markPayrollPaid);
router.patch('/update/:id', requireAuth(['admin']), updatePayroll);
router.delete('/delete/:payrollId', requireAuth(['admin']), deleteDraftPayroll);
router.get('/my-history', requireAuth(['admin', 'teacher']), getMySalaryHistory);
router.get('/download-slip/:slipId', requireAuth(['admin', 'teacher']), downloadSalarySlip);

// 5. Dynamic/Generic Routes LAST
router.get('/', requireAuth(['admin']), getMonthlyPayroll);
router.patch('/:payrollId/pay', requireAuth(['admin']), markPayrollPaid);
router.delete('/:payrollId', requireAuth(['admin']), deleteDraftPayroll);

export default router;