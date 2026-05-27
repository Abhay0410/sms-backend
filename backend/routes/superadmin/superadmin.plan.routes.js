import express from "express";
import {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  assignPlanToSchool
} from "../../controllers/superadmin/superadmin.plan.controller.js";
import { superAdminAuth } from "../../middleware/superAdminAuth.js";

const router = express.Router();

router.use(superAdminAuth);

router.get("/", getAllPlans);
router.post("/", createPlan);
router.get("/:id", getPlanById);
router.put("/:id", updatePlan);
router.patch("/assign/:schoolId", assignPlanToSchool);

export default router;