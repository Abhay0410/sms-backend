// utils/jwt.js - FIXED WITH LAZY LOADING
import jwt from "jsonwebtoken";

let JWT_SECRET;
let JWT_EXPIRES;
let isInitialized = false;

// Lazy initialization function
function initialize() {
  if (!isInitialized) {
    JWT_SECRET = process.env.JWT_SECRET;
    
    // 🚨 CRITICAL: Force crash if secret is missing
    if (!JWT_SECRET) {
      console.error("❌ FATAL ERROR: JWT_SECRET is not defined in .env file.");
      console.error("   Please add JWT_SECRET=your-super-secret-jwt-key-change-this-in-production to your .env file");
      process.exit(1); 
    }

    JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
    isInitialized = true;

    console.log("🔐 JWT Utils Initialized (Secret Verified):");
    console.log("  JWT_SECRET length:", JWT_SECRET.length);
    console.log("  JWT_EXPIRES:", JWT_EXPIRES);
  }
}

/**
 * Sign a JWT token
 */
export const signToken = (payload) => {
  initialize(); // Initialize on first use
  
  if (!payload.id || !payload.role || !payload.schoolId) {
    console.error("❌ Missing required payload fields for JWT");
    throw new Error("Invalid payload for JWT token");
  }
  
  console.log("🔐 Signing token with payload:", {
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
  initialize(); // Initialize on first use
  
  try {
    if (!token) {
      throw new Error("No token provided");
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Validate decoded payload structure
    if (!decoded.id || !decoded.role || !decoded.schoolId) {
      throw new Error("Invalid token structure");
    }
    
    console.log("✅ Token verified successfully:", {
      id: decoded.id,
      role: decoded.role,
      schoolId: decoded.schoolId,
      expires: new Date(decoded.exp * 1000).toISOString()
    });
    
    return decoded;
  } catch (error) {
    console.error("❌ Token verification failed:", error.message);
    
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
  initialize();
  return { JWT_SECRET, JWT_EXPIRES };
};

// Export constants (lazy loaded)
export { JWT_SECRET, JWT_EXPIRES };

export default {
  signToken,
  verifyToken,
  decodeToken,
  isTokenExpiringSoon,
  getJWTConfig
};