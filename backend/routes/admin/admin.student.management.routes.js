// routes/admin/admin.student.management.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  getStudentsManagement,
  bulkUpdateStatus,
  promoteStudents,
  bulkDeleteStudents,
  getStudentStatistics,
  transferStudents
} from "../../controllers/admin/admin.student.management.controller.js";

const router = Router();

console.log("🔧 Admin student management routes loading...");

// All routes require admin auth
router.use(requireAuth(["admin"]));

// Get students with advanced filters
router.get("/list", getStudentsManagement);
router.get("/students", getStudentsManagement); // Alias

// Statistics
router.get("/statistics", getStudentStatistics);
router.get("/stats", getStudentStatistics); // Alias

// Bulk operations
router.put("/bulk-update-status", bulkUpdateStatus);
router.post("/bulk-status", bulkUpdateStatus); // Alias

router.put("/promote", promoteStudents);
router.post("/promote", promoteStudents); // Alias

router.delete("/bulk-delete", bulkDeleteStudents);
router.post("/bulk-delete", bulkDeleteStudents); // Alias

router.post("/transfer", transferStudents);

console.log("✅ Admin student management routes loaded");

export default router;
