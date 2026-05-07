// utils/jwt.js - SIMPLIFIED
import jwt from "jsonwebtoken";
import "../config/env.js"; // Strictly enforce env requirements early
import logger from "./logger.js";

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

/**
 * Sign a JWT token
 */
export const signToken = (payload) => {
  if (!payload.id || !payload.role || !payload.schoolId) {
    logger.error("Missing required payload fields for JWT", { payload });
    throw new Error("Invalid payload for JWT token");
  }
  
  logger.debug("Signing token with payload", {
    id: payload.id,
    role: payload.role,
    schoolId: payload.schoolId,
    isSuperAdmin: payload.isSuperAdmin || false
  });
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
};

/**
 * Verify a JWT token
 */
export const verifyToken = (token) => {
  try {
    if (!token) {
      throw new Error("No token provided");
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Validate decoded payload structure
    if (!decoded.id || !decoded.role || !decoded.schoolId) {
      throw new Error("Invalid token structure");
    }
    
    return decoded;
  } catch (error) {
    logger.error("Token verification failed", { error: error.message });
    
    if (error.name === "TokenExpiredError") {
      throw new Error("Token expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    } else {
      throw new Error("Authentication failed: " + error.message);
    }
  }
};

/**
 * Decode a JWT token without verifying
 */
export const decodeToken = (token) => {
  if (!token) return null;
  return jwt.decode(token);
};

/**
 * Check if token is about to expire (within 1 hour)
 */
export const isTokenExpiringSoon = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decoded.exp - now;
    
    return expiresIn < 3600; // Less than 1 hour
  } catch {
    return false;
  }
};

// Export getters for configuration
export const getJWTConfig = () => {
  return { JWT_SECRET, JWT_EXPIRES };
};

export default {
  signToken,
  verifyToken,
  decodeToken,
  isTokenExpiringSoon,
  getJWTConfig
};