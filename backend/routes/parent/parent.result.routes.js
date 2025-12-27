import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
// ✅ IMPORT THE CORRECT CONTROLLER
import { getChildResults,downloadResult } from "../../controllers/parent/parent.result.controller.js";

const router = Router();

// This MUST be in the RESULTS router file, not the timetable one
router.get("/:childId", requireAuth(["parent"]), getChildResults); 
router.get("/:resultId/download", requireAuth(["parent"]), downloadResult);
export default router;