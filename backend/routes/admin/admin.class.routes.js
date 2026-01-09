import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  createClass,
  addSection,
  getClasses,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  assignStudentsToSection,
  shiftStudentSection,
  promoteStudents,
  copyAcademicYear,
  getAcademicYears,
  updateClassFeeStructure,
  getClassStatistics, // 👈 Add this import
} from "../../controllers/admin/admin.class.controller.js";

const router = Router();

// Standard routes
router.post("/create", requireAuth(["admin"]), createClass);
router.post("/", requireAuth(["admin"]), createClass);

// Statistics & List (Place these before /:classId)
router.get("/statistics", requireAuth(["admin"]), getClassStatistics); // 👈 New Route
router.get("/list", requireAuth(["admin"]), getClasses);
router.get("/academic-years", requireAuth(["admin"]), getAcademicYears);

// Section management
router.post("/:classId/section", requireAuth(["admin"]), addSection);
router.put("/:classId/section/:sectionName/assign-students", requireAuth(["admin"]), assignStudentsToSection);
router.put("/:classId/shift-student", requireAuth(["admin"]), shiftStudentSection);

// Class CRUD
router.get("/", requireAuth(["admin"]), getAllClasses);
router.get("/:classId", requireAuth(["admin"]), getClassById);
router.put("/:classId", requireAuth(["admin"]), updateClass);
router.delete("/:classId", requireAuth(["admin"]), deleteClass);

router.put("/:classId/fee-structure", requireAuth(["admin"]), updateClassFeeStructure);
router.post("/promote", requireAuth(["admin"]), promoteStudents);
router.post("/copy-academic-year", requireAuth(["admin"]), copyAcademicYear);

export default router;