// routes/admin/admin.teacher.management.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  getTeachersWithAssignments,
  assignClassTeacher,
  assignSubjectTeacher,
  assignTeacherToSection,
  removeClassTeacher,
  removeSubjectTeacher,
  removeTeacherFromSection,
  getTeacherAssignments,
  getSectionTeachers,
  getAvailableSubjectsForSection,
  getTeacherScheduleForAdmin,
} from "../../controllers/admin/admin.teacher.management.controller.js";

const router = Router();

console.log("🔧 Admin teacher management routes loading...");

// All routes require admin auth
router.use(requireAuth(["admin"]));

// Get teachers
router.get("/list", getTeachersWithAssignments);
router.get("/teachers", getTeachersWithAssignments); // Alias
router.get("/:teacherId/assignments", getTeacherAssignments);
router.get("/section-teachers", getSectionTeachers);
router.get('/teacher-schedule', getTeacherScheduleForAdmin);
// Assign teachers
router.post("/assign", assignTeacherToSection);
router.put("/assign-class-teacher", assignClassTeacher);
router.put("/assign-subject-teacher", assignSubjectTeacher);
router.post("/assign-subject", assignSubjectTeacher); // Alias

// Remove teachers
router.post("/remove", removeTeacherFromSection);
router.delete("/remove-class-teacher", removeClassTeacher);
router.delete("/remove-subject-teacher", removeSubjectTeacher);
router.post("/remove-subject", removeSubjectTeacher); // Alias

router.get('/available-subjects', getAvailableSubjectsForSection);

console.log("✅ Admin teacher management routes loaded");

export default router;
