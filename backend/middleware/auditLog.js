import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

export const auditLogger = (req, res, next) => {
  // Only log state-changing requests (Skip standard GET requests to save DB space)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    
    // Wait for the response to finish so we can grab the final req.user & status code
    res.on('finish', async () => {
      try {
        // We only care if an authenticated user performed the action
        if (req.user) {
          const sanitizedBody = { ...req.body };
          
          // Scrub sensitive security fields
          const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'token'];
          for (const field of sensitiveFields) {
            if (sanitizedBody[field]) sanitizedBody[field] = '***';
          }

          await AuditLog.create({
            schoolId: req.schoolId || req.user.schoolId,
            user: req.user.id,
            userRole: req.user.role,
            action: req.method,
            resource: req.originalUrl || req.url,
            details: sanitizedBody,
            ipAddress: req.ip,
            status: res.statusCode
          });
        }
      } catch (error) {
        logger.error('Audit Log saving failed', { error: error.message });
      }
    });
  }
  next();
};