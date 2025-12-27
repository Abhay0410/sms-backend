// routes/admin/admin.announcement.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { uploadAnnouncementAttachments } from "../../middleware/upload.js";
import {
  getAllAnnouncements,
  getAnnouncementClasses,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  deleteAttachment,
  togglePin,
} from "../../controllers/admin/admin.announcement.controller.js"; // ✅ ADMIN controller

const router = Router();

console.log("🔧 Admin announcement routes loading...");

// All routes require admin auth
router.use(requireAuth(["admin"]));

// Get all announcements (with pagination and filters)
router.get("/", getAllAnnouncements);

// Get classes for dropdown
router.get("/classes", getAnnouncementClasses);

// Create announcement (with file uploads - up to 5 files)
router.post(
  "/",
  uploadAnnouncementAttachments.array("attachments", 5),
  createAnnouncement
);

// Update announcement (with optional file uploads)
router.put(
  "/:id",
  uploadAnnouncementAttachments.array("attachments", 5),
  updateAnnouncement
);

// Delete announcement
router.delete("/:id", deleteAnnouncement);

// Delete specific attachment
router.delete("/:announcementId/attachment/:attachmentId", deleteAttachment);

// Toggle pin status
router.put("/:id/toggle-pin", togglePin);

console.log("✅ Admin announcement routes loaded");

export default router;
