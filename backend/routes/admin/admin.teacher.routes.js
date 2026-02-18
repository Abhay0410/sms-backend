// routes/admin/admin.teacher.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import upload from "../../middleware/multer.js";
import {
  createTeacher,
  getTeachers,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  assignClassTeacher,
  assignSubjectTeacher,
  updateTeacherStatus,
  toggleTeacherStatus
} from "../../controllers/admin/admin.teacher.controller.js";

const router = Router();

console.log("🔧 Admin teacher routes loading...");

// All routes require admin authentication
router.use(requireAuth(["admin"]));

// Teacher CRUD
// router.post("/", createTeacher);
// router.post("/create", createTeacher); // Alias for backward compatibility
router.post("/", upload.single("profilePicture"), createTeacher);
router.post("/create", upload.single("profilePicture"), createTeacher);
router.get("/", getAllTeachers);
router.get("/list", getTeachers); // Alias for backward compatibility
router.get("/:teacherId", getTeacherById);
router.put("/:teacherId", upload.single("profilePicture"), updateTeacher);
router.delete("/:teacherId", deleteTeacher);

// Teacher assignments
router.post("/:teacherId/assign-class", assignClassTeacher);
router.post("/:teacherId/assign-subject", assignSubjectTeacher);

// Teacher status
router.put("/:teacherId/status", updateTeacherStatus);
router.put("/:id/toggle-status", toggleTeacherStatus); // For your existing route

console.log("✅ Admin teacher routes loaded");

export default router;
