import express from 'express';
import { submitContactForm } from '../../controllers/public/contact.controller.js';

const router = express.Router();

// POST /api/public/contact
router.post('/contact', submitContactForm);

export default router;
