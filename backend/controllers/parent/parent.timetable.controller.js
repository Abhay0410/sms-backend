// controllers/parent/parent.timetable.controller.js
import Timetable from "../../models/Timetable.js";
import Student from "../../models/Student.js";
import Enrollment from "../../models/Enrollment.js";
import { successResponse } from "../../utils/response.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../utils/errors.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

export const getChildTimetable = asyncHandler(async (req, res) => {
  const parentId = req.user.id;
  const { childId } = req.params;

  // 1. Verify this child belongs to the logged-in parent
  const student = await Student.findOne({
    _id: childId,
    parent: parentId,
    schoolId: req.schoolId
  }).select("name studentID").lean();

  if (!student) {
    throw new AuthorizationError("You are not authorized to view this student's timetable.");
  }

  // 2. Fetch the child's current enrollment
  const enrollment = await Enrollment.findOne({
    student: childId,
    schoolId: req.schoolId,
    status: 'ACTIVE'
  }).lean();

  if (!enrollment || !enrollment.class || !enrollment.section) {
    throw new ValidationError("This child has not been assigned to a class/section yet.");
  }

  // 3. Fetch the published timetable for that class/section
  const timetable = await Timetable.findOne({
    schoolId: req.schoolId,
    class: enrollment.class,
    section: enrollment.section,
    academicYear: enrollment.academicYear,
    isActive: true,
    status: "published",
  }).populate("schedule.periods.teacher", "name teacherID");

  if (!timetable) {
    throw new NotFoundError(`Timetable not found for ${enrollment.className}-${enrollment.section}`);
  }

  return successResponse(res, "Child's timetable retrieved successfully", timetable);
});

export default {
  getChildTimetable,
};