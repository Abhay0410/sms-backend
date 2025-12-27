// controllers/teacher/teacher.timetable.controller.js - MULTI-TENANT VERSION
import Timetable from "../../models/Timetable.js";
import Class from "../../models/Class.js";
import Teacher from "../../models/Teacher.js";
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { NotFoundError } from "../../utils/errors.js";

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// Get my schedule - MULTI-TENANT
export const getMySchedule = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const { academicYear = getCurrentAcademicYear() } = req.query;

  console.log(`📅 Fetching schedule for teacher: ${teacherId}, year: ${academicYear}`);

  // ✅ MULTI-TENANT: Verify teacher belongs to school
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId  // ✅ CRITICAL
  }).select("name teacherID assignedClasses subjects");

  if (!teacher) {
    throw new NotFoundError("Teacher");
  }

  // ✅ MULTI-TENANT: Get teacher's assigned classes first
  const teacherClassIds = teacher.assignedClasses?.map(ac => ac.class) || [];

  // Method 1: Get from Timetable collection (most accurate)
  const timetables = await Timetable.find({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    class: { $in: teacherClassIds },
    academicYear,
    status: "published",
    isActive: true
  }).populate({
    path: 'class',
    select: 'className academicYear'
  });

  // Method 2: Fallback - Check Class model sections
  const classes = await Class.find({ 
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    academicYear,
    $or: [
      { "sections.classTeacher": teacherId }, 
      { "sections.subjects.teacher": teacherId }
    ] 
  }).select("className sections academicYear");

  const schedule = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: []
  };

  let hasAssignments = false;

  // Process Timetables (Primary source)
  timetables.forEach((timetable) => {
    if (timetable.schedule) {
      timetable.schedule.forEach((dayEntry) => {
        dayEntry.periods.forEach((period) => {
          if (period.teacher && period.teacher.toString() === teacherId) {
            hasAssignments = true;
            
            schedule[dayEntry.day].push({
              className: timetable.className || timetable.class?.className || "N/A",
              section: timetable.section,
              periodNumber: period.periodNumber,
              startTime: period.startTime,
              endTime: period.endTime,
              subject: period.subject || "N/A",
              room: period.room || "N/A",
              classId: timetable.class || timetable.classId,
              timetableId: timetable._id,
              role: "Subject Teacher"
            });
          }
        });
      });
    }
  });

  // Process Class sections (Fallback for class teacher duties)
  classes.forEach((cls) => {
    cls.sections.forEach((section) => {
      // Check if teacher is class teacher
      const isClassTeacher = section.classTeacher && 
        section.classTeacher.toString() === teacherId;
      
      // Check if teacher teaches any subjects
      const teachesSubjects = section.subjects.some(
        sub => sub.teacher && sub.teacher._id.toString() === teacherId
      );

      console.log(`🏫 ${cls.className}-${section.sectionName}: ClassTeacher=${isClassTeacher}, TeachesSubjects=${teachesSubjects}`);

      if (isClassTeacher || teachesSubjects) {
        hasAssignments = true;
        
        // Add class teacher periods (if timetable not available)
        if (isClassTeacher && !schedule['Monday'].some(p => p.section === section.sectionName)) {
          ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
            schedule[day].push({
              className: cls.className,
              section: section.sectionName,
              periodNumber: "Class Teacher",
              startTime: "Full Day",
              endTime: "Full Day",
              subject: "Class Teacher Duty",
              classId: cls._id,
              sectionId: section._id,
              role: "Class Teacher"
            });
          });
        }
      }
    });
  });

  // Sort each day by period number
  Object.keys(schedule).forEach((day) => {
    schedule[day].sort((a, b) => {
      if (a.periodNumber === "Class Teacher") return -1;
      if (b.periodNumber === "Class Teacher") return 1;
      return Number(a.periodNumber) - Number(b.periodNumber);
    });
  });

  return successResponse(res, 
    hasAssignments ? "Teacher schedule retrieved successfully" : "No classes assigned", 
    {
      teacher: {
        id: teacher._id,
        name: teacher.name,
        teacherID: teacher.teacherID,
        subjects: teacher.subjects || [],
      },
      academicYear,
      schedule,
      hasAssignments,
      summary: {
        totalPeriods: Object.values(schedule).flat().length,
        uniqueClasses: new Set(Object.values(schedule).flat().map(p => `${p.className}-${p.section}`)).size
      },
      message: hasAssignments ? "" : "You are not assigned to any classes or subjects for this academic year."
    }
  );
});

export default {
  getMySchedule,
};
