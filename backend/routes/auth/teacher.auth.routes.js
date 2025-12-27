// routes/auth/teacher.auth.routes.js - PRODUCTION READY
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";
import {
  login,
  validate,
  profile,
  updateProfile,
  changePassword,
  logout
} from "../../controllers/auth/teacher.auth.controller.js";
import jwt from "jsonwebtoken";

const router = Router();

console.log("🔧 Teacher auth routes loading...");

// Public routes
router.post("/login", login);

// 🛠️ DEBUG ROUTES - KEEP FOR PRODUCTION (environment/token debugging)
router.get("/check-env", (req, res) => {
  res.json({
    success: true,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET: process.env.JWT_SECRET ? `Present (${process.env.JWT_SECRET.length} chars)` : "MISSING ⚠️",
      JWT_EXPIRES: process.env.JWT_EXPIRES
    }
  });
});

router.get("/debug-token", (req, res) => {
  // ... keep existing debug logic (very useful!)
});

// Protected routes
router.post("/validate", requireAuth(["teacher"]), validate);
router.get("/profile", requireAuth(["teacher"]), profile);
router.put("/profile", requireAuth(["teacher"]), upload.single("photo"), updateProfile);
router.put("/change-password", requireAuth(["teacher"]), changePassword);
router.post("/logout", requireAuth(["teacher"]), logout);

console.log("✅ Teacher auth routes loaded");
export default router;
