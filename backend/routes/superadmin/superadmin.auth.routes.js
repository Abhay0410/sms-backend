import express from "express";
import {
  setupInitialSuperAdmin,
  login,
  getProfile,
  logout
} from "../../controllers/superadmin/superadmin.auth.controller.js";
import { superAdminAuth } from "../../middleware/superAdminAuth.js";

const router = express.Router();

// Public Super Admin routes
router.post("/setup", setupInitialSuperAdmin);
router.post("/login", login);

// Protected Super Admin routes
router.get("/profile", superAdminAuth, getProfile);
router.post("/logout", superAdminAuth, logout);

export default router;