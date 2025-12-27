import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { 
    getStudentThreads, 
    getStudentThreadById, 
    replyToThreadStudent 
} from "../../controllers/student/student.message.controller.js";

const router = Router();

// Student auth middleware
router.use(requireAuth(["student"]));

// Sabhi threads load karne ke liye
router.get('/', getStudentThreads);

// Ek specific chat open karne ke liye
router.get('/:threadId', getStudentThreadById);

// Reply bhejne ke liye
router.post('/:threadId/reply', replyToThreadStudent);

export default router;