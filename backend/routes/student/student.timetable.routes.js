// routes/student.timetable.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getMyTimetable } from "../../controllers/student/student.timetable.controller.js";

const router = Router();

console.log("🔧 Student timetable routes loading...");

router.get("/my-timetable", requireAuth(["student"]), getMyTimetable);

console.log("✅ Student timetable routes loaded");

export default router;
