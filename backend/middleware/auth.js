// middleware/auth.js - MULTI-TENANT VERSION (UPDATED FOR LAZY LOADING)
import jwt from "jsonwebtoken";
import { AuthenticationError } from "../utils/errors.js";
// ✅ Import the getter function from your central utility
import { getJWTConfig } from "../utils/jwt.js";

export const requireAuth = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      console.log("\n🔐 Auth Middleware (Multi-Tenant):");
      console.log("  Path:", req.path);
      console.log("  Method:", req.method);
      console.log("  Allowed roles:", allowedRoles.length > 0 ? allowedRoles : "Any authenticated role");

      const authHeader = req.headers.authorization;
      const cookieToken = req.cookies?.studentToken || req.cookies?.adminToken || req.cookies?.teacherToken || req.cookies?.parentToken;
      // ✨ ADD THIS LINE: URL query se token nikalne ke liye
      const queryToken = req.query.token; 

      let token = null;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
        console.log("  Auth header: Present (Bearer)");
      } else if (cookieToken) {
        token = cookieToken;
        console.log("  Using token from cookie");
      } else if (queryToken) { // ✨ NEW CONDITION
        token = queryToken;
        console.log("  Using token from URL query");
      } else {
        console.log("  ❌ No Bearer token, cookie token, or query token found");
        throw new AuthenticationError("No token provided");
      }

      if (!token) {
        console.log("  ❌ Token is empty");
        throw new AuthenticationError("No token provided");
      }

      console.log("  Token length:", token.length);

      // ✅ Get JWT_SECRET using the getter function
      const { JWT_SECRET } = getJWTConfig();
      console.log("  JWT_SECRET length:", JWT_SECRET.length);

      // ✅ Uses the imported JWT_SECRET (verified to exist)
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log("  ✅ Token decoded:", {
        id: decoded.id,
        schoolId: decoded.schoolId || 'N/A',
        role: decoded.role,
        isSuperAdmin: decoded.isSuperAdmin || false,
        exp: new Date(decoded.exp * 1000).toISOString(),
      });

      if (!decoded || !decoded.role) {
        console.log("  ❌ Invalid token structure");
        throw new AuthenticationError("Invalid token");
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        console.log("  ❌ Role not allowed:", decoded.role, "- Required:", allowedRoles);
        throw new AuthenticationError("Insufficient permissions");
      }

      // ✅ MULTI-TENANT: Populate req.user with schoolId
      req.user = {
        id: decoded.id,
        schoolId: decoded.schoolId,  // ✅ CRITICAL for all queries
        role: decoded.role,
        isSuperAdmin: decoded.isSuperAdmin || false,
        tokenExpiry: decoded.exp
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
          error: "AUTH_INVALID_TOKEN"
        });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired. Please login again.",
          error: "AUTH_TOKEN_EXPIRED"
        });
      }

      if (error.name === "AuthenticationError") {
        return res.status(401).json({
          success: false,
          message: error.message,
          error: "AUTH_FAILED"
        });
      }

      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: "AUTH_ERROR"
      });
    }
  };
};

// ✅ School Admin only middleware
export const requireSchoolAdmin = () => {
  return requireAuth(['admin']);
};

// ✅ Teacher only middleware
export const requireTeacher = () => {
  return requireAuth(['teacher']);
};

// ✅ Student only middleware
export const requireStudent = () => {
  return requireAuth(['student']);
};

// ✅ Parent only middleware
export const requireParent = () => {
  return requireAuth(['parent']);
};

// ✅ Role-based with school context
export const requireRole = (roles) => {
  return requireAuth(roles);
};

// ✅ Super Admin only (platform-wide)
export const requireSuperAdmin = () => {
  return (req, res, next) => {
    requireAuth(['admin'])(req, res, () => {
      if (!req.user.isSuperAdmin) {
        console.log("  ❌ Super admin access required but user is not super admin");
        return res.status(403).json({
          success: false,
          message: "Super admin access required",
          error: "ACCESS_DENIED_SUPER_ADMIN"
        });
      }
      console.log("  ✅ Super admin access granted");
      next();
    });
  };
};

// ✅ School middleware - extracts schoolId from params/user
export const setSchoolContext = async (req, res, next) => {
  try {
    console.log("\n🏫 Setting school context:");
    
    // Priority order for determining schoolId:
    // 1. Already authenticated user's schoolId (from token)
    // 2. URL parameter
    // 3. Request body
    // 4. Header
    const schoolId = req.user?.schoolId || 
                    req.params.schoolId || 
                    req.body.schoolId || 
                    req.headers['x-school-id'];
    
    if (!schoolId) {
      console.log("  ❌ School ID required but not found");
      return res.status(400).json({
        success: false,
        message: "School ID required",
        error: "SCHOOL_ID_REQUIRED"
      });
    }
    
    // Ensure schoolId is consistent
    if (req.user?.schoolId && req.user.schoolId !== schoolId) {
      console.log("  ⚠️ Warning: User schoolId mismatch:", {
        userSchoolId: req.user.schoolId,
        requestedSchoolId: schoolId
      });
      // For security, we might want to reject this request
      // return res.status(403).json({
      //   success: false,
      //   message: "Access denied to requested school",
      //   error: "SCHOOL_ACCESS_DENIED"
      // });
    }
    
    req.schoolId = schoolId;
    console.log("  ✅ School context set:", req.schoolId);
    next();
  } catch (error) {
    console.error("  ❌ Error setting school context:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "SCHOOL_CONTEXT_ERROR"
    });
  }
};

// ✅ Middleware to ensure user belongs to the requested school
export const ensureSchoolAccess = () => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.schoolId) {
        throw new AuthenticationError("Authentication required");
      }
      
      // If user is super admin, allow access to all schools
      if (req.user.isSuperAdmin) {
        console.log("  ⚡ Super admin bypassing school access check");
        return next();
      }
      
      const requestedSchoolId = req.params.schoolId || req.body.schoolId;
      
      if (requestedSchoolId && requestedSchoolId !== req.user.schoolId) {
        console.log("  ❌ School access denied:", {
          userSchoolId: req.user.schoolId,
          requestedSchoolId: requestedSchoolId
        });
        return res.status(403).json({
          success: false,
          message: "Access denied to this institution",
          error: "SCHOOL_ACCESS_DENIED"
        });
      }
      
      console.log("  ✅ School access verified");
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default requireAuth;