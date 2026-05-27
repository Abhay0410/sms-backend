import School from "../models/School.js";
import { asyncHandler } from "./errorHandler.js";
import logger from "../utils/logger.js";

/**
 * Middleware to restrict access to premium modules based on the school's active SaaS plan.
 * @param {String} moduleName - The name of the feature (e.g., 'TRANSPORT', 'PAYROLL')
 */
export const requireModule = (moduleName) => {
  return asyncHandler(async (req, res, next) => {
    // Skip if no school context is available (safeguard)
    if (!req.schoolId) {
      logger.warn(`Feature gate checked without schoolId context for module: ${moduleName}`);
      return res.status(400).json({ success: false, message: "School context missing." });
    }

    const school = await School.findById(req.schoolId).select("modulesEnabled").lean();

    if (!school) {
      return res.status(404).json({ success: false, message: "Institution not found." });
    }

    // Check if the requested module is present in the school's enabled modules
    if (!school.modulesEnabled || !school.modulesEnabled.includes(moduleName)) {
      logger.warn("Blocked access to premium module", { schoolId: req.schoolId, module: moduleName, path: req.path });
      return res.status(403).json({ 
        success: false, 
        message: `Premium Feature Locked. Please upgrade your subscription plan to access the ${moduleName} module.` 
      });
    }

    next();
  });
};