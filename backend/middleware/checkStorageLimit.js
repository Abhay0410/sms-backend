import School from "../models/School.js";
import { asyncHandler } from "./errorHandler.js";
import logger from "../utils/logger.js";

/**
 * Middleware to check if the institution has exceeded its allowed subscription storage limit.
 * Blocks file upload requests before files are processed by Multer / Cloudinary.
 */
export const checkStorageLimit = asyncHandler(async (req, res, next) => {
  if (!req.schoolId) {
    return next();
  }

  const school = await School.findById(req.schoolId).select("storageUsed maxStorageMB").lean();
  if (!school) {
    return res.status(404).json({ success: false, message: "Institution not found." });
  }

  // -1 represents Unlimited storage
  if (school.maxStorageMB && school.maxStorageMB !== -1 && school.storageUsed >= school.maxStorageMB) {
    logger.warn("Blocked file upload: Storage limit exceeded", { 
      schoolId: req.schoolId, 
      storageUsed: school.storageUsed.toFixed(2), 
      maxStorageMB: school.maxStorageMB 
    });
    
    return res.status(403).json({
      success: false,
      message: `Storage Limit Exceeded (${school.maxStorageMB} MB). Please upgrade your subscription plan or delete old files/attachments to upload more.`
    });
  }

  next();
});
