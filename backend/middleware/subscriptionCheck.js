import School from "../models/School.js";
import { asyncHandler } from "./errorHandler.js";
import logger from "../utils/logger.js";

export const subscriptionCheck = asyncHandler(async (req, res, next) => {
  // If there is no school context, skip the check
  if (!req.schoolId) {
    return next();
  }

  const school = await School.findById(req.schoolId).select("status").lean();

  if (!school) {
    return res.status(404).json({ success: false, message: "Institution not found." });
  }

  if (school.status === "SUSPENDED") {
    logger.warn("Blocked access to suspended school", { schoolId: req.schoolId, path: req.path });
    return res.status(403).json({ success: false, message: "Institution account is suspended due to unpaid invoices or violations. Please contact support." });
  }

  if (school.status === "PENDING") {
    logger.warn("Blocked access to pending school", { schoolId: req.schoolId, path: req.path });
    return res.status(403).json({ success: false, message: "Institution account is pending approval." });
  }

  next();
});