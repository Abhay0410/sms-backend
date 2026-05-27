import jwt from "jsonwebtoken";
import SuperAdmin from "../models/SuperAdmin.js";
import { AuthenticationError } from "../utils/errors.js";
import { asyncHandler } from "./errorHandler.js";
import { getJWTConfig } from "../utils/jwt.js";
import logger from "../utils/logger.js";

export const superAdminAuth = asyncHandler(async (req, res, next) => {
  let token;
  
  // Extract token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new AuthenticationError("Not authorized to access Super Admin route. No token provided.");
  }

  try {
    const { JWT_SECRET } = getJWTConfig();
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const superAdmin = await SuperAdmin.findById(decoded.id);
    
    if (!superAdmin) {
      throw new AuthenticationError("Super Admin account not found.");
    }

    if (!superAdmin.isActive) {
      throw new AuthenticationError("Super Admin account is deactivated.");
    }

    // Attach to request object for downstream controllers
    req.user = decoded; // { id, role, isSuperAdmin }
    req.superAdmin = superAdmin; 
    
    next();
  } catch (error) {
    logger.error("Super Admin Auth Error", { name: error.name, message: error.message, tokenProvided: !!token });
    
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    throw new AuthenticationError(`Not authorized. ${error.message}`);
  }
});