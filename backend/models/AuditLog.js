import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', index: true }, // Tenant Context
  user: { type: mongoose.Schema.Types.ObjectId, required: true }, // Who
  userRole: { type: String, required: true }, // Role (admin, teacher, parent)
  action: { type: String, required: true }, // POST, PUT, DELETE
  resource: { type: String, required: true }, // Target URL Endpoint
  details: { type: mongoose.Schema.Types.Mixed }, // Sanitized payload data
  ipAddress: { type: String }, // Network Origin
  status: { type: Number } // Resulting HTTP Status Code
}, { timestamps: true });

export default mongoose.model('AuditLog', auditLogSchema);