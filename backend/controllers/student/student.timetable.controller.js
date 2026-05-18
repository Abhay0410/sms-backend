// controllers/student/student.timetable.controller.js - MULTI-TENANT VERSION
import Timetable from "../../models/Timetable.js";
import Student from "../../models/Student.js";
import Enrollment from "../../models/Enrollment.js";
import Class from "../../models/Class.js";
import { successResponse } from "../../utils/response.js";
import { NotFoundError, ValidationError } from "../../utils/errors.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

// GET /api/student/timetable/my-timetable - MULTI-TENANT
export const getMyTimetable = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  // ✅ MULTI-TENANT: 1) Verify student belongs to school
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId  // ✅ CRITICAL
  }).select("name studentID").lean();

  if (!student) {
    throw new NotFoundError("Student");
  }

  // ✅ NEW: Fetch current enrollment data
  const enrollment = await Enrollment.findOne({
    student: studentId,
    schoolId: req.schoolId,
    status: 'ACTIVE'
  }).lean();

  if (!enrollment || !enrollment.class || !enrollment.section) {
    throw new ValidationError("You have not been assigned to a class/section yet");
  }

  // ✅ MULTI-TENANT: 2) Timetable from Timetable collection (school-scoped)
  const timetable = await Timetable.findOne({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    class: enrollment.class,    // Use ObjectId ref from enrollment
    section: enrollment.section,
    academicYear: enrollment.academicYear,
    isActive: true,
    status: "published",
  }).populate("schedule.periods.teacher", "name teacherID");

  if (!timetable) {
    throw new NotFoundError(`Timetable not found for ${enrollment.className}-${enrollment.section}`);
  }

  // ✅ MULTI-TENANT: 3) Get class teacher from Class model
  const classData = await Class.findOne({
    _id: enrollment.class,
    schoolId: req.schoolId
  }).select("sections");

  let classTeacher = null;
  if (classData && classData.sections) {
    const studentSection = classData.sections.find(sec => sec.sectionName === enrollment.section);
    if (studentSection?.classTeacher) {
      classTeacher = await Student.populate(studentSection, {
        path: 'classTeacher',
        select: 'name teacherID'
      });
      classTeacher = studentSection.classTeacher;
    }
  }

  // 4) Derive subjects (unique subjectName + teacher + hoursPerWeek)
  const subjectMap = new Map();

  timetable.schedule.forEach((day) => {
    day.periods.forEach((p) => {
      if (!p.isBreak && p.subject && p.subject !== "N/A") {
        const key = `${p.subject}-${p.teacher || 'no-teacher'}`;
        if (!subjectMap.has(key)) {
          subjectMap.set(key, {
            subjectName: p.subject,
            teacher: p.teacher ? p.teacher.name : null,
            teacherID: p.teacher ? p.teacher.teacherID : null,
            hoursPerWeek: 0,
          });
        }
        const s = subjectMap.get(key);
        s.hoursPerWeek += 1;
      }
    });
  });

  const subjects = Array.from(subjectMap.values());

  // 5) Response shape expected by ViewTimetable.jsx
  return successResponse(res, "Timetable retrieved successfully", {
    student: {
      name: student.name,
      studentID: student.studentID,
      className: enrollment.className,
      section: enrollment.section,
    },
    classTeacher,
    subjects,
    timetable: timetable.schedule || [],
    academicYear: enrollment.academicYear,
    effectiveFrom: timetable.effectiveFrom,
    effectiveTo: timetable.effectiveTo
  });
});

export default {
  getMyTimetable,
};
