import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getMySchedule } from "../../controllers/teacher/teacher.timetable.controller.js";

const router = Router();

console.log("🔧 Teacher timetable routes loading...");

router.get("/my-schedule", requireAuth(["teacher"]), getMySchedule);

console.log("✅ Teacher timetable routes loaded");

export default router;
