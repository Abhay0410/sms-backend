// routes/admin/admin.student.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  getAllStudents,
  getStudentById,
  createStudent,
  createStudentWithParent, // ✅ Add this
  updateStudent,
  deleteStudent,
  bulkUploadStudents,
  updateStudentStatus,
  promoteStudents
} from "../../controllers/admin/admin.student.controller.js";
import upload from "../../middleware/multer.js";

const router = Router();

console.log("🔧 Admin student routes loading...");

router.use(requireAuth(["admin"]));

router.get("/", getAllStudents);
router.get("/list", getAllStudents);
router.get("/:studentId", getStudentById);

// ✅ TWO CREATE ENDPOINTS
router.post("/", createStudent); // Simple create
router.post("/with-parent", createStudentWithParent); // ✅ Full registration

router.put("/:studentId",upload.single("profilePicture"), updateStudent);
router.delete("/:studentId", deleteStudent);
router.post("/bulk-upload", bulkUploadStudents);
router.put("/:studentId/status", updateStudentStatus);
router.post("/promote", promoteStudents);

console.log("✅ Admin student routes loaded");

export default router;
