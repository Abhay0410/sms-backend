// routes/parent/parent.announcement.routes.js - PRODUCTION READY
import { Router } from 'express';  // ✅ Consistent import
import { requireAuth } from '../../middleware/auth.js';
import * as announcementController from '../../controllers/parent/parent.announcement.controller.js';

const router = Router();

console.log("🔧 Parent announcement routes loading...");

router.use(requireAuth(['parent']));

router.get('/', announcementController.getAllAnnouncements);
router.get('/pinned', announcementController.getPinnedAnnouncements);
router.get('/child/:childId', announcementController.getAnnouncementsByChild);
router.get('/:announcementId', announcementController.getAnnouncementById);
router.post('/:announcementId/mark-read', announcementController.markAsRead);

console.log("✅ Parent announcement routes loaded - 5 routes");

export default router;
