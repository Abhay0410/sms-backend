// routes/student/student.announcement.routes.js
import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as announcementController from '../../controllers/student/student.announcement.controller.js';

const router = express.Router();

router.use(requireAuth(['student']));

router.get('/', announcementController.getAllAnnouncements); // ✅ View all
router.get('/pinned', announcementController.getPinnedAnnouncements); // ✅ Get pinned
router.get('/:announcementId', announcementController.getAnnouncementById); // ✅ View single
router.post('/:announcementId/mark-read', announcementController.markAsRead); // ✅ Mark as read

export default router;
