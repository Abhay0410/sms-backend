// utils/jwt.js - SIMPLE DIRECT FIX
import jwt from "jsonwebtoken";

// Use the same JWT secret everywhere
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

console.log("🔐 JWT Utils Initialized:");
console.log("  JWT_SECRET length:", JWT_SECRET.length);
console.log("  JWT_EXPIRES:", JWT_EXPIRES);

/**
 * Sign a JWT token
 */
export const signToken = (payload) => {
  console.log("🔐 Signing token with secret length:", JWT_SECRET.length);
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
};

/**
 * Verify a JWT token
 */
export const verifyToken = (token) => {
  try {
    console.log("🔐 Verifying token with secret length:", JWT_SECRET.length);
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.log("❌ Token verification failed:", error.message);
    throw new Error("Invalid or expired token");
  }
};

/**
 * Decode a JWT token without verifying
 */
export const decodeToken = (token) => {
  return jwt.decode(token);
};

export default {
  signToken,
  verifyToken,
  decodeToken,
};