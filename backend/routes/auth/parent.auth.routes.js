// routes/auth/parent.auth.routes.js - CLEANED
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";
import {
  login,
  validate,
  profile,
  getChildren,
  updateProfile,
  changePassword,
  logout
} from "../../controllers/auth/parent.auth.controller.js";

const router = Router();

console.log("🔧 Parent auth routes loading...");

// Public routes
router.post("/login", login);

// Protected routes - FIXED middleware order
router.post("/validate", requireAuth(["parent"]), validate);
router.get("/profile", requireAuth(["parent"]), profile);
router.get("/children", requireAuth(["parent"]), getChildren);
router.put("/profile", requireAuth(["parent"]), upload.single("photo"), updateProfile); // ✅ Middleware first
router.put("/change-password", requireAuth(["parent"]), changePassword);
router.post("/logout", requireAuth(["parent"]), logout);

console.log("✅ Parent auth routes loaded");
export default router;
