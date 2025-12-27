// routes/admin/admin.class.routes.js
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
  promoteStudents,
  copyAcademicYear,
  getAcademicYears,
  updateClassFeeStructure,
} from "../../controllers/admin/admin.class.controller.js";

const router = Router();

console.log("🔧 Admin class routes loading...");

// All routes require admin auth (except create for testing)
router.post("/create", requireAuth(["admin"]), createClass);
router.post("/", requireAuth(["admin"]), createClass); // Standard route

// Section management
router.post("/:classId/section", requireAuth(["admin"]), addSection);
router.put("/:classId/section/:sectionName/assign-students", requireAuth(["admin"]), assignStudentsToSection);

// Class CRUD
router.get("/list", requireAuth(["admin"]), getClasses);
router.get("/", requireAuth(["admin"]), getAllClasses);
router.get("/academic-years", requireAuth(["admin"]), getAcademicYears);
router.get("/:classId", requireAuth(["admin"]), getClassById);
router.put("/:classId", requireAuth(["admin"]), updateClass);
router.delete("/:classId", requireAuth(["admin"]), deleteClass);

router.put("/:classId/fee-structure", requireAuth(["admin"]), updateClassFeeStructure);

// Student promotion
router.post("/promote", requireAuth(["admin"]), promoteStudents);

// Academic year management
router.post("/copy-academic-year", requireAuth(["admin"]), copyAcademicYear);

console.log("✅ Admin class routes loaded");

export default router;
