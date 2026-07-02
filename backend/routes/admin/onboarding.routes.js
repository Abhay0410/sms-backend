// routes/admin/onboarding.routes.js
import express from 'express';
import multer from 'multer';
import { 
  importStudents, 
  importAcademics, 
  importTeachers,
  importFeeStructures,
  importFeePayments,
  importLibraryBooks
} from '../../controllers/admin/onboarding.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/temp/' }); 

router.use(requireAuth(['admin'])); 

// Step 1: Academic Structure
router.post('/import-academics', upload.single('file'), importAcademics);

// Step 2: Teachers
router.post('/import-teachers', upload.single('file'), importTeachers);

// Step 3: Students
router.post('/import-students', upload.single('file'), importStudents);

// Step 4: Fee Structures
router.post('/import-fee-structures', upload.single('file'), importFeeStructures);

// Step 5: Fee Payments 
router.post('/import-fee-payments', upload.single('file'), importFeePayments);

// Step 6: Library Books
router.post('/import-library-books', upload.single('file'), importLibraryBooks);

export default router;