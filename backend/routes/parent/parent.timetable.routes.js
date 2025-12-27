// ✅ KEEP THIS ONE (Router pattern + logging)
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getChildTimetable } from "../../controllers/parent/parent.timetable.controller.js";

const router = Router();

console.log("🔧 Parent timetable routes loading...");

router.get("/:childId", requireAuth(["parent"]), getChildTimetable);

console.log("✅ Parent timetable routes loaded");

export default router;
