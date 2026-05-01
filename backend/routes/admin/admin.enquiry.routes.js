import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  createEnquiry,
  addFollowUp,
  updateEnquiryStatus,
  closeEnquiry,
  massAssignEnquiries,
  convertEnquiryToStudent,
  getEnquiries,
  getEnquiryById,
  getEnquiryDashboard,
  getEnquiryAnalytics
} from '../../controllers/admin/admin.enquiry.controller.js';

const router = Router();

// Dashboard & Analytics (Must be above /:enquiryId to prevent param collisions)
router.get('/dashboard', requireAuth(['admin']), getEnquiryDashboard);
router.get('/analytics', requireAuth(['admin']), getEnquiryAnalytics);

// Mass Actions (Must be above /:enquiryId)
router.post('/mass-assign', requireAuth(['admin']), massAssignEnquiries);

// Base Enquiry CRUD
router.get('/', requireAuth(['admin']), getEnquiries);
router.post('/', requireAuth(['admin']), createEnquiry);
router.get('/:enquiryId', requireAuth(['admin']), getEnquiryById);

// Pipeline & Workflow Actions
router.post('/:enquiryId/follow-ups', requireAuth(['admin']), addFollowUp);
router.patch('/:enquiryId/status', requireAuth(['admin']), updateEnquiryStatus);

// Conversions & Closures (Stage 5)
router.post('/:enquiryId/convert', requireAuth(['admin']), convertEnquiryToStudent);
router.post('/:enquiryId/close', requireAuth(['admin']), closeEnquiry);

export default router;