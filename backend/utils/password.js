import crypto from 'crypto';

/**
 * Generates a cryptographically secure random password.
 * @param {number} length - The length of the password (default: 12)
 * @returns {string} The generated secure password
 */
export const generateSecurePassword = (length = 12) => {
  // Generates a random base64 string and removes unsafe characters like +, /, and =
  return crypto.randomBytes(length).toString('base64').slice(0, length).replace(/[\+\/\=]/g, 'a');
};