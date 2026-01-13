import express from 'express';
import upload from '../../middleware/multer.js';
import { uploadToCloudinary } from '../../utils/cloudinaryUpload.js';
// backend/routes/admin/admin.routes.js
import { registerAdmin } from '../../controllers/admin/admin.registration.controller.js';
import { updateAdmin } from '../../controllers/admin/admin.registration.controller.js';
// import { requireSuperAdmin } from '../../middleware/auth.js';
import {requireSchoolAdmin } from '../../middleware/auth.js';


const router = express.Router();

// Public registration (or protect with superAdminOnly if needed)
router.post('/register',requireSchoolAdmin(),upload.single('profilePicture'), registerAdmin);
router.put("/update/:id", upload.single("profilePicture"), updateAdmin);


export default router;
