// backend/routes/school/school.routes.js - FIXED
import express from 'express';
import School from '../../models/School.js'; // Add this import
import { asyncHandler } from '../../middleware/errorHandler.js'; // Add this
import { successResponse } from '../../utils/response.js'; // Add this
import { NotFoundError } from '../../utils/errors.js'; // Add this
import { 
  registerSchool, 
  getSchoolProfile,
  getAllSchools
} from '../../controllers/school/school.controller.js';

const router = express.Router();

// Existing routes
router.post('/register', registerSchool);
router.get('/profile', getSchoolProfile);
router.get('/list', getAllSchools);

// ✅ NEW: Get school by slug
router.get('/slug/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  console.log("🔍 Looking for school with slug:", slug);
  
  // Try to find school by slug or by slugified schoolName
  const school = await School.findOne({
    $or: [
      { slug: slug },
      { 
        schoolName: new RegExp(`^${slug.replace(/-/g, ' ')}$`, 'i'),
        isActive: true 
      }
    ]
  }).select('_id schoolName schoolCode address logo slug isActive');
  
  console.log("🔍 Found school:", school ? school.schoolName : "None");
  
  if (!school) {
    throw new NotFoundError('School not found');
  }
  
  return successResponse(res, 'School found', school);
}));

// ✅ NEW: Active schools endpoint
router.get('/active', asyncHandler(async (req, res) => {
  const schools = await School.find({ isActive: true })
    .select('_id schoolName schoolCode address logo slug')
    .lean();
  
  return successResponse(res, 'Active schools retrieved', schools);
}));

export default router;