import StaffAttendance from '../../models/StaffAttendance.js';
import LeaveRequest from '../../models/LeaveRequest.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError } from '../../utils/errors.js';

/* ──────────────────────────────────────────────────────────────
 * 🕒 ATTENDANCE OPERATIONS
 * ────────────────────────────────────────────────────────────── */

// Mark daily attendance (Check-in)
export const markAttendance = asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const schoolId = req.schoolId;
    const today = new Date().setHours(0, 0, 0, 0);

    // Check if already marked for today
    const existingRecord = await StaffAttendance.findOne({
        teacherId,
        schoolId,
        date: today
    });

    if (existingRecord) {
        throw new ValidationError('Attendance for today has already been marked.');
    }

    const newRecord = new StaffAttendance({
        schoolId,
        teacherId,
        date: today,
        checkIn: new Date().toLocaleTimeString('en-IN', { hour12: false }),
        status: 'PRESENT'
    });

    await newRecord.save();
    return successResponse(res, 'Checked in successfully', newRecord, 201);
});

// Update attendance (Check-out)
export const markCheckOut = asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const today = new Date().setHours(0, 0, 0, 0);

    const record = await StaffAttendance.findOne({ teacherId, date: today });
    if (!record) throw new ValidationError('No check-in record found for today.');

    record.checkOut = new Date().toLocaleTimeString('en-IN', { hour12: false });
    await record.save();

    return successResponse(res, 'Checked out successfully', record);
});

/* ──────────────────────────────────────────────────────────────
 * 📅 LEAVE OPERATIONS
 * ────────────────────────────────────────────────────────────── */

// Apply for a new leave
export const applyLeave = asyncHandler(async (req, res) => {
    const { leaveType, startDate, endDate, reason } = req.body;
    const teacherId = req.user.id;
    const schoolId = req.schoolId;

    if (!leaveType || !startDate || !endDate || !reason) {
        throw new ValidationError('Please provide all required leave details.');
    }

    const newLeave = new LeaveRequest({
        schoolId,
        teacherId,
        leaveType,
        startDate,
        endDate,
        reason,
        status: 'PENDING'
    });

    await newLeave.save();
    return successResponse(res, 'Leave application submitted', newLeave, 201);
});

// Get my leave history
export const getMyLeaves = asyncHandler(async (req, res) => {
    const leaves = await LeaveRequest.find({ 
        teacherId: req.user.id,
        schoolId: req.schoolId 
    }).sort({ createdAt: -1 });

    return successResponse(res, 'Leave history retrieved', leaves);
});
export const getMyTodayAttendance = asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const today = new Date().setHours(0, 0, 0, 0);

    const record = await StaffAttendance.findOne({ 
        teacherId, 
        date: today,
        schoolId: req.schoolId 
    });

    // If no record, return null so frontend knows to show "Check In" button
    return successResponse(res, 'Today\'s status retrieved', record || null);
});
// Get teacher's own attendance history (last 30 days)
export const getRecentAttendance = asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const schoolId = req.schoolId;

    // Fetch records from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = await StaffAttendance.find({
        teacherId,
        schoolId,
        date: { $gte: thirtyDaysAgo }
    }).sort({ date: -1 });

    return successResponse(res, 'Recent attendance history retrieved', history);
});

export const getAttendanceStats = asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const records = await StaffAttendance.find({
        teacherId,
        schoolId: req.schoolId,
        date: { $gte: firstDay, $lte: lastDay }
    });

    // Helper to calculate minutes from HH:mm:ss
    const getMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    let totalMinutesWorked = 0;
    let daysWithCheckOut = 0;

    records.forEach(r => {
        if (r.checkIn && r.checkOut) {
            totalMinutesWorked += (getMinutes(r.checkOut) - getMinutes(r.checkIn));
            daysWithCheckOut++;
        }
    });

    const stats = {
        presentDays: records.filter(r => ['PRESENT', 'HALF_DAY', 'LATE'].includes(r.status)).length,
        lateDays: records.filter(r => r.status === 'LATE').length,
        totalWorkingDays: 26, // Usually fixed per month
        attendanceRate: records.length > 0 ? ((records.length / 26) * 100).toFixed(1) : 0,
        avgHours: daysWithCheckOut > 0 ? (totalMinutesWorked / daysWithCheckOut / 60).toFixed(1) : 0
    };

    return successResponse(res, 'Stats retrieved', stats);
});