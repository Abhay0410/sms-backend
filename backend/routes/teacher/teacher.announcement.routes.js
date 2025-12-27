import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { uploadAnnouncementAttachments } from "../../middleware/upload.js";

import {
  getAllAnnouncements,
  getMySections,
  getMyAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from "../../controllers/teacher/teacher.announcement.controller.js";

const router = Router();

console.log("🔧 Teacher announcement routes loading...");

router.use(requireAuth(["teacher"]));

router.get("/", getAllAnnouncements);
router.get("/my-sections", getMySections);
router.get("/my-announcements", getMyAnnouncements);

router.post(
  "/",
  uploadAnnouncementAttachments.array("attachments", 5),
  createAnnouncement
);

router.delete("/:id", deleteAnnouncement);

console.log("✅ Teacher announcement routes loaded");

export default router;
