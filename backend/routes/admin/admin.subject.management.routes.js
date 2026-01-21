// routes/admin/admin.subject.management.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  getAllSubjects,
  getSubjectsByClass,
  addSubjectToClass,
  addSubjectToSections,
  updateSubject,
  removeSubject,
  removeSubjectFromSections,
  getSubjectStatistics,
  removeSubjectFromMasterPool
} from "../../controllers/admin/admin.subject.management.controller.js";  // ✅ FIXED PATH

const router = Router();

console.log("🔧 Admin subject management routes loading...");

router.use(requireAuth(["admin"]));

router.get("/", getAllSubjects);
router.get("/all", getAllSubjects);
router.get("/class/:classId", getSubjectsByClass);
router.delete("/remove-from-pool", removeSubjectFromMasterPool);
router.get("/statistics", getSubjectStatistics);

router.post("/add", addSubjectToClass);
router.post("/add-to-sections", addSubjectToSections);
router.post("/", addSubjectToClass);

router.put("/update", updateSubject);
router.put("/", updateSubject);

router.delete("/remove", removeSubject);
router.delete("/remove-from-sections", removeSubjectFromSections);
router.post("/remove", removeSubject);

console.log("✅ Admin subject management routes loaded");

export default router;
