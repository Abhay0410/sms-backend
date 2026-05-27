// routes/admin.payroll.routes.js
import { Router } from 'express';
import { 
  calculateAndSetSalary, 
  getAttendanceStats, 
  runMonthlyPayroll,
  getUnifiedStaffList,
  getAttendanceMatrix,
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
import { requireModule } from '../../middleware/featureGate.js';

const router = Router();

const requirePayroll = requireModule('PAYROLL');

// 1. Specific Static Routes FIRST
router.get('/attendance-stats', requireAuth(['admin']), requirePayroll, getAttendanceStats);
router.get('/staff-list', requireAuth(['admin']), requirePayroll, getUnifiedStaffList);
router.get('/summary', requireAuth(['admin']), requirePayroll, getPayrollSummary);
router.get('/matrix', requireAuth(['admin']), requirePayroll, getAttendanceMatrix);

// 2. Generation Routes
// ✅ Ensure this matches what the Frontend is calling via the Constant
router.post('/run-payroll', requireAuth(['admin']), requirePayroll, runMonthlyPayroll); 

// Standard bulk generate
router.post('/generate', requireAuth(['admin']), requirePayroll, generateMonthlyPayroll);

// 3. Structure Routes
router.get('/policy', requireAuth(['admin']), requirePayroll, getSchoolPayrollPolicy);
router.post('/policy', requireAuth(['admin']), requirePayroll, updateSchoolPayrollPolicy);
router.post('/setup-salary', requireAuth(['admin']), requirePayroll, calculateAndSetSalary);
router.post('/setup-structure', requireAuth(['admin']), requirePayroll, calculateAndSetSalary);
router.get('/structure/:teacherId', requireAuth(['admin']), requirePayroll, getPayrollStructure);
router.patch('/teachers/:teacherId/salary', requireAuth(['admin']), requirePayroll, updateTeacherSalary);

// 4. Other Specific Routes
router.get('/teacher/:teacherId', requireAuth(['admin']), requirePayroll, getTeacherPayrollHistory);
router.get('/slip-details/:slipId', requireAuth(['admin', 'teacher']), requirePayroll, getPayrollDetails);
router.put('/mark-paid/:slipId', requireAuth(['admin']), requirePayroll, markPayrollPaid);
router.patch('/update/:id', requireAuth(['admin']), requirePayroll, updatePayroll);
router.delete('/delete/:payrollId', requireAuth(['admin']), requirePayroll, deleteDraftPayroll);
router.get('/my-history', requireAuth(['admin', 'teacher']), requirePayroll, getMySalaryHistory);
router.get('/download-slip/:slipId', requireAuth(['admin', 'teacher']), requirePayroll, downloadSalarySlip);

// 5. Dynamic/Generic Routes LAST
router.get('/', requireAuth(['admin']), requirePayroll, getMonthlyPayroll);
router.patch('/:payrollId/pay', requireAuth(['admin']), requirePayroll, markPayrollPaid);
router.delete('/:payrollId', requireAuth(['admin']), requirePayroll, deleteDraftPayroll);

export default router;