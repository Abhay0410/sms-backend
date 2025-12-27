import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js"; 
import {
    createThreadTeacher,
    replyToThreadTeacher,
    getTeacherThreads,
    getThreadByIdTeacher,
    getTeacherSections,
    searchRecipients
} from "../../controllers/teacher/teacher.message.controller.js";

const router = Router();
router.use(requireAuth(["teacher"]));

// 1. Static Routes (Top)
router.get("/", getTeacherThreads);
router.get("/my-sections", getTeacherSections); // GET /api/teacher/messages/my-sections
router.get("/search-recipients", searchRecipients);
router.post("/thread", createThreadTeacher);

// 2. Dynamic Routes (Bottom)
router.get("/:threadId", getThreadByIdTeacher); // This will only catch if it's NOT "my-sections"
router.post("/:threadId/reply", replyToThreadTeacher);



export default router;