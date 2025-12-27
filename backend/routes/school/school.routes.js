// backend/routes/school/school.routes.js
import express from 'express';
import { 
  registerSchool, 
  getSchoolProfile,
  getAllSchools // ✅ Import MUST be present
} from '../../controllers/school/school.controller.js';

const router = express.Router();

router.post('/register', registerSchool);
router.get('/profile', getSchoolProfile);
router.get('/list', getAllSchools); // ✅ Route MUST be present

export default router;
