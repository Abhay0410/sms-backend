// routes/admin/admin.timetable.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  createTimetable,
  getAllTimetables,
  getTimetableById,
  getTimetableByClassSection,
  updateTimetable,
  deleteTimetable,
  toggleTimetableStatus,
  publishTimetable,      // ✅ Import
  unpublishTimetable,    // ✅ Import
  addDay,
  createPeriod,
  addBreak,
  updatePeriod,
  deletePeriod,
  copyTimetable
} from "../../controllers/admin/admin.timetable.controller.js";

const router = Router();

console.log("🔧 Admin timetable routes loading...");

// All routes require admin auth
router.use(requireAuth(["admin"]));

// ⚠️ IMPORTANT: Specific routes MUST come BEFORE dynamic routes

// Copy timetable (must be before /:timetableId)
router.post("/copy", copyTimetable);

// Get by class section (must be before /:timetableId)
router.get("/by-class-section", getTimetableByClassSection);

// Get all timetables
router.get("/", getAllTimetables);

// Create timetable
router.post("/", createTimetable);

// Get, Update, Delete by ID
router.get("/:timetableId", getTimetableById);
router.put("/:timetableId", updateTimetable);
router.delete("/:timetableId", deleteTimetable);

// Toggle active/inactive status
router.put("/:timetableId/toggle-status", toggleTimetableStatus);

// ✅ Publish/Unpublish routes
router.put("/:timetableId/publish", publishTimetable);
router.put("/:timetableId/unpublish", unpublishTimetable);

// Day management
router.post("/:timetableId/day", addDay);

// Period management
router.post("/:timetableId/:day/period", createPeriod);
router.post("/:timetableId/:day/break", addBreak);
router.put("/:timetableId/:day/period/:periodId", updatePeriod);
router.delete("/:timetableId/:day/period/:periodId", deletePeriod);

console.log("✅ Admin timetable routes loaded");

export default router;
