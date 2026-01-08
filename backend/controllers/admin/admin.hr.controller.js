import StaffAttendance from '../../models/StaffAttendance.js';
import LeaveRequest from '../../models/LeaveRequest.js';
import Teacher from '../../models/Teacher.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

// Get today's attendance for all staff
export const getAllStaffAttendance = asyncHandler(async (req, res) => {
    const { date } = req.query;
    const searchDate = date ? new Date(date).setHours(0,0,0,0) : new Date().setHours(0,0,0,0);

    const attendance = await StaffAttendance.find({ 
        schoolId: req.schoolId,
        date: searchDate 
    }).populate('teacherId', 'name teacherID department');

    return successResponse(res, 'Staff attendance retrieved', attendance);
});

// Approve or Reject Leave
export const processLeaveRequest = asyncHandler(async (req, res) => {
    const { leaveId } = req.params;
    const { status, adminRemarks } = req.body; // status: APPROVED or REJECTED

    const leave = await LeaveRequest.findOne({ _id: leaveId, schoolId: req.schoolId });
    if (!leave) throw new Error('Leave request not found');

    leave.status = status;
    leave.adminRemarks = adminRemarks;
    await leave.save();

    // Logic: If approved, update Teacher model status if leave starts today
    if (status === 'APPROVED') {
        const today = new Date().setHours(0,0,0,0);
        if (new Date(leave.startDate) <= today && new Date(leave.endDate) >= today) {
            await Teacher.findByIdAndUpdate(leave.teacherId, { status: 'ON_LEAVE' });
        }
    }

    return successResponse(res, `Leave request ${status.toLowerCase()} successfully`, leave);
});
export const getMonthlyAttendanceReport = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const schoolId = req.schoolId;

  // Calculate date range
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Fetch all teachers
  const teachers = await Teacher.find({ schoolId, isActive: true }).select('name teacherID department');

  const report = await Promise.all(teachers.map(async (teacher) => {
    const attendanceRecords = await StaffAttendance.find({
      teacherId: teacher._id,
      date: { $gte: startDate, $lte: endDate }
    });

    const approvedLeaves = await LeaveRequest.find({
      teacherId: teacher._id,
      status: 'APPROVED',
      startDate: { $gte: startDate },
      endDate: { $lte: endDate }
    });

    return {
      teacherName: teacher.name,
      teacherID: teacher.teacherID,
      presentDays: attendanceRecords.filter(r => r.status === 'PRESENT').length,
      absentDays: attendanceRecords.filter(r => r.status === 'ABSENT').length,
      halfDays: attendanceRecords.filter(r => r.status === 'HALF_DAY').length,
      leaves: approvedLeaves.length
    };
  }));

  return successResponse(res, 'Monthly report generated', report);
});

export const updateStaffAttendance = asyncHandler(async (req, res) => {
    const { attendanceId } = req.params;
    const { status, remarks } = req.body;

    // Validation: Status uppercase hona chahiye aur valid enum value honi chahiye
    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'];
    const updatedStatus = status.toUpperCase();

    if (!validStatuses.includes(updatedStatus)) {
        throw new ValidationError(`Invalid status. Use: ${validStatuses.join(', ')}`);
    }

    const record = await StaffAttendance.findOneAndUpdate(
        { _id: attendanceId, schoolId: req.schoolId },
        { $set: { status: updatedStatus, remarks: remarks || "" } },
        { new: true } // Taaki update hone ke baad naya data return kare
    );

    if (!record) throw new NotFoundError('Attendance Record');

    return successResponse(res, 'Status updated successfully', record);
});
// Get all leave requests for the school (Admin View)
export const getAllLeaves = asyncHandler(async (req, res) => {
    const leaves = await LeaveRequest.find({ schoolId: req.schoolId })
        .populate('teacherId', 'name teacherID department') // 👈 Crucial for the UI
        .sort({ createdAt: -1 });

    return successResponse(res, 'All leave requests retrieved', leaves);
});