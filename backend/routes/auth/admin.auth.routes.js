// routes/auth/admin.auth.routes.js
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
} from "../../controllers/auth/admin.auth.controller.js";

const router = Router();

console.log("🔧 Admin auth routes loading...");

// Public routes
router.post("/login", login);

// Protected routes
router.post("/validate", requireAuth(["admin"]), validate);
router.get("/profile", requireAuth(["admin"]), profile);
router.put("/profile", upload.single("photo"), updateProfile);
router.put("/change-password", requireAuth(["admin"]), changePassword);
router.post("/logout", requireAuth(["admin"]), logout);

console.log("✅ Admin auth routes loaded");

export default router;
