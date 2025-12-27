// routes/parent/parent.message.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { 
    getParentThreads, 
    getParentThreadById, // Added this
    replyToThreadParent 
} from "../../controllers/parent/parent.message.controller.js";

const router = Router();
router.use(requireAuth(["parent"]));

router.get('/', getParentThreads);
router.get('/:threadId', getParentThreadById); // ✅ Important for loading specific chat
router.post('/:threadId/reply', replyToThreadParent);

export default router;