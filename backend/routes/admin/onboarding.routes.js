// routes/admin/onboarding.routes.js
import express from 'express';
import multer from 'multer';
import { 
  importStudents, 
  importAcademics, 
  importTeachers 
} from '../../controllers/admin/onboarding.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/temp/' }); 

// ✅ Sabhi phases ke liye routes register karein
router.use(requireAuth(['admin'])); 

// Step 1: Academic Structure
router.post('/import-academics', upload.single('file'), importAcademics);

// Step 2: Teachers
router.post('/import-teachers', upload.single('file'), importTeachers);

// Step 3: Students
router.post('/import-students', upload.single('file'), importStudents);

export default router;