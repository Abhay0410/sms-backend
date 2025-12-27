import jwt from "jsonwebtoken";

export function signToken(payload, opts = {}) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES || "1d";
  return jwt.sign(payload, secret, { expiresIn, ...opts });
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  return jwt.verify(token, secret);
}
