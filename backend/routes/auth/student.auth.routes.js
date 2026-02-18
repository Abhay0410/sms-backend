// routes/auth/student.auth.routes.js - CLEANED
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";
import {
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  validateToken,
} from "../../controllers/auth/student.auth.controller.js";

const router = Router();

// Public routes
router.post("/login", login);
router.post("/validate", validateToken);

// Protected routes - INDIVIDUAL middleware (no use())
router.get("/profile", requireAuth(["student"]), getProfile);
router.put("/profile", requireAuth(["student"]), upload.single("profilePicture"), updateProfile);
router.put("/change-password", requireAuth(["student"]), changePassword);
router.post("/logout", requireAuth(["student"]), logout);

export default router;
