// controllers/parent/parent.timetable.controller.js - MULTI-TENANT
import Timetable from "../../models/Timetable.js";
import Class from "../../models/Class.js";
import Student from "../../models/Student.js";
import Parent from "../../models/Parent.js";
import { successResponse } from "../../utils/response.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../../utils/errors.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

export const getChildTimetable = asyncHandler(async (req, res) => {
  const parentId = req.user.id;
  const { childId } = req.params;

  console.log("🔍 TIMETABLE - Parent:", parentId, "Child:", childId);

  // ✅ MULTI-TENANT: Verify parent belongs to school
  const parent = await Parent.findOne({
    _id: parentId,
    schoolId: req.schoolId  // ✅ School verification
  }).populate("children", "_id name studentID class section className");

  if (!parent) {
    throw new NotFoundError("Parent");
  }

  // Verify parent owns this child
  const isMyChild = parent.children.some(child => child._id.toString() === childId);
  if (!isMyChild) {
    throw new ForbiddenError("You don't have access to this student's data");
  }

  // ✅ MULTI-TENANT: Get child details with school filter
  const child = await Student.findOne({
    _id: childId,
    schoolId: req.schoolId  // ✅ Tenant isolation
  }).select("className section academicYear name studentID class");

  if (!child) {
    throw new NotFoundError("Student");
  }

  if (!child.class || !child.section) {
    throw new ValidationError("Student has not been assigned to a class/section yet");
  }

  // ✅ PRIMARY: Try Timetable collection first (most accurate)
  const timetable = await Timetable.findOne({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    class: child.class,
    section: child.section,
    academicYear: child.academicYear,
    isActive: true,
    status: "published"
  }).populate("schedule.periods.teacher", "name teacherID");

  let classTeacher = null;
  let subjects = [];
  let timetableData = [];

  if (timetable) {
    // Timetable found - extract subjects
    const subjectMap = new Map();
    timetable.schedule.forEach(day => {
      day.periods.forEach(period => {
        if (!period.isBreak && period.subject) {
          const key = period.subject;
          if (!subjectMap.has(key)) {
            subjectMap.set(key, {
              subjectName: period.subject,
              teacher: period.teacher ? {
                name: period.teacher.name,
                teacherID: period.teacher.teacherID
              } : null
            });
          }
        }
      });
    });
    subjects = Array.from(subjectMap.values());
    timetableData = timetable.schedule;
  } else {
    // FALLBACK: Class model
    const classDoc = await Class.findOne({
      schoolId: req.schoolId,  // ✅ MULTI-TENANT
      _id: child.class
    })
      .populate({
        path: 'sections.classTeacher',
        select: 'name teacherID'
      })
      .populate({
        path: 'sections.subjects.teacher',
        select: 'name teacherID'
      });

    if (classDoc) {
      const section = classDoc.sections.find(s => s.sectionName === child.section);
      if (section) {
        classTeacher = section.classTeacher;
        subjects = section.subjects || [];
      }
    }
  }

  return successResponse(res, "Child's timetable retrieved successfully", {
    child: {
      name: child.name,
      studentID: child.studentID,
      className: child.className,
      section: child.section,
      academicYear: child.academicYear
    },
    classTeacher,
    subjects,
    timetable: timetableData,
    source: timetable ? "Timetable" : "Class Model"
  });
});

export default {
  getChildTimetable
};
