// controllers/admin/admin.payroll.controller.js
import Payroll from '../../models/Payroll.js';
import Teacher from '../../models/Teacher.js';
import LeaveRequest from '../../models/LeaveRequest.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { successResponse } from '../../utils/response.js';
export const generateMonthlyPayroll = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  const schoolId = req.schoolId;

  const teachers = await Teacher.find({ schoolId, status: 'ACTIVE' });

  const payrollPromises = teachers.map(async (teacher) => {
    // 1. Calculate Unpaid Leaves
    const unpaidLeaves = await LeaveRequest.countDocuments({
      teacherId: teacher._id,
      status: 'APPROVED',
      leaveType: 'UNPAID',
      startDate: { $gte: new Date(year, month - 1, 1) },
      endDate: { $lte: new Date(year, month, 0) }
    });

    // 2. Simple Salary Formula
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyRate = (teacher.salary?.basic || 0) / daysInMonth;
    const leaveDeduction = unpaidLeaves * dailyRate;
    
    // 3. Pension (Example: 10% of basic)
    const pension = (teacher.salary?.basic || 0) * 0.10;

    const netSalary = (teacher.salary?.total || 0) - leaveDeduction - pension;

    return {
      schoolId,
      teacherId: teacher._id,
      month,
      year,
      baseSalary: teacher.salary?.basic,
      allowances: teacher.salary?.allowances,
      pensionContribution: pension,
      unpaidLeaveDeduction: leaveDeduction,
      netSalary: Math.max(0, netSalary),
      status: 'DRAFT'
    };
  });

  const payrollRecords = await Promise.all(payrollPromises);
  await Payroll.insertMany(payrollRecords);

  return successResponse(res, 'Payroll drafted for all teachers', payrollRecords);
});