// middleware/auth.js - MULTI-TENANT VERSION
import jwt from "jsonwebtoken";
import { AuthenticationError } from "../utils/errors.js";

// Use the same JWT secret as in jwt.js
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

export const requireAuth = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      console.log("\n🔐 Auth Middleware (Multi-Tenant):");
      console.log("  Path:", req.path);
      console.log("  Method:", req.method);
      console.log("  Allowed roles:", allowedRoles);

      const authHeader = req.headers.authorization;
      const cookieToken = req.cookies?.studentToken;

      let token = null;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
        console.log("  Auth header: Present (Bearer)");
      } else if (cookieToken) {
        token = cookieToken;
        console.log("  Using token from studentToken cookie");
      } else {
        console.log("  ❌ No Bearer token or cookie token found");
        throw new AuthenticationError("No token provided");
      }

      console.log("  Token length:", token.length);
      console.log("  JWT_SECRET length:", JWT_SECRET.length);

      const decoded = jwt.verify(token, JWT_SECRET);
      console.log("  ✅ Token decoded:", {
        id: decoded.id,
        schoolId: decoded.schoolId || 'N/A',  // ✅ NEW: schoolId
        role: decoded.role,
        isSuperAdmin: decoded.isSuperAdmin || false,  // ✅ NEW
        exp: decoded.exp,
        iat: decoded.iat,
      });

      if (!decoded || !decoded.role) {
        console.log("  ❌ Invalid token structure");
        throw new AuthenticationError("Invalid token");
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        console.log("  ❌ Role not allowed:", decoded.role);
        throw new AuthenticationError("Insufficient permissions");
      }

      // ✅ MULTI-TENANT: Populate req.user with schoolId
      req.user = {
        id: decoded.id,
        schoolId: decoded.schoolId,  // ✅ CRITICAL for all queries
        role: decoded.role,
        isSuperAdmin: decoded.isSuperAdmin || false,
      };

      // ✅ SET req.schoolId for easy access in controllers
      req.schoolId = decoded.schoolId;

      console.log("  ✅ Auth successful - User:", {
        id: req.user.id,
        schoolId: req.schoolId,
        role: req.user.role,
        isSuperAdmin: req.user.isSuperAdmin
      });
      next();
    } catch (error) {
      console.log("  ❌ Auth failed:", error.message);

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
        });
      }

      return res.status(401).json({
        success: false,
        message: error.message || "Authentication failed",
      });
    }
  };
};

// ✅ NEW: School-specific auth middleware
export const requireSchoolAdmin = () => {
  return requireAuth(['admin']);
};

// ✅ NEW: Role-based with school context
export const requireRole = (roles) => {
  return requireAuth(roles);
};

// ✅ NEW: Super Admin only (platform-wide)
export const requireSuperAdmin = () => {
  return (req, res, next) => {
    requireAuth(['admin'])(req, res, () => {
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: "Super admin access required"
        });
      }
      next();
    });
  };
};

// ✅ NEW: School middleware - extracts schoolId from params/user
export const setSchoolContext = async (req, res, next) => {
  try {
    // Priority: 1. URL param, 2. User schoolId, 3. Header
    req.schoolId = req.params.schoolId || 
                   req.user?.schoolId || 
                   req.headers['x-school-id'];
    
    if (!req.schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID required"
      });
    }
    
    console.log("🏫 School context set:", req.schoolId);
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default requireAuth;
