import express from 'express';
import { upload } from '../../middleware/upload.js';
import { registerAdmin } from '../../controllers/admin/admin.registration.controller.js';
import { updateAdmin } from '../../controllers/admin/admin.registration.controller.js';
import {requireSchoolAdmin } from '../../middleware/auth.js';

const router = express.Router();

router.post('/register',requireSchoolAdmin(),upload.single('profilePicture'), registerAdmin);
router.put("/update/:id", upload.single("profilePicture"), updateAdmin);


export default router;
