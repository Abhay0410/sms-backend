import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { uploadAnnouncementAttachments } from "../../middleware/upload.js";

import {
  getAllAnnouncements,
  getMySections,
  getMyAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  deleteAttachment,
  updateAnnouncement,
  togglePin
} from "../../controllers/teacher/teacher.announcement.controller.js";

const router = Router();

console.log("🔧 Teacher announcement routes loading...");

router.use(requireAuth(["teacher"]));

router.get("/", getAllAnnouncements);
router.get("/my-sections", getMySections);
router.get("/my-announcements", getMyAnnouncements);
router.delete("/attachment/:announcementId/:attachmentId", deleteAttachment);

router.post(
  "/",
  uploadAnnouncementAttachments.array("attachments", 5),
  createAnnouncement
);

router.put(
  "/:id",
  uploadAnnouncementAttachments.array("attachments", 5),
  updateAnnouncement
);

router.patch("/:id/toggle-pin", togglePin);

router.delete("/:id", deleteAnnouncement);

console.log("✅ Teacher announcement routes loaded");

export default router;
