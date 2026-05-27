import express from "express";
import { getDashboardMetrics } from "../../controllers/superadmin/superadmin.metrics.controller.js";
import { superAdminAuth } from "../../middleware/superAdminAuth.js";

const router = express.Router();

// Protect all metric routes
router.use(superAdminAuth);

// Dashboard analytics
router.get("/dashboard", getDashboardMetrics);

export default router;