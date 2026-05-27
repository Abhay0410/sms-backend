import express from "express";
import {
  getAllSchools,
  getSchoolById,
  createSchool,
  updateSchoolStatus,
  impersonateTenant
} from "../../controllers/superadmin/superadmin.school.controller.js";
import { superAdminAuth } from "../../middleware/superAdminAuth.js";

const router = express.Router();

// All school management routes strictly require Super Admin privileges
router.use(superAdminAuth);

router.get("/", getAllSchools);
router.post("/", createSchool);
router.get("/:id", getSchoolById);
router.patch("/:id/status", updateSchoolStatus);
router.post("/:id/impersonate", impersonateTenant);

export default router;