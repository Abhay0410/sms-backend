import School from '../models/School.js';
import Teacher from '../models/Teacher.js';
import Admin from '../models/Admin.js';
import TransportStaff from '../models/TransportStaff.js';
import { ValidationError } from './errors.js';

/**
 * Checks if adding staff exceeds the school's capacity limits.
 * Counts active Teachers, active sub-Admins (excluding main superadmin), and Transport staff.
 * @param {string} schoolId 
 * @param {number} countToAdd 
 */
export const checkStaffLimit = async (schoolId, countToAdd = 1) => {
  const school = await School.findById(schoolId).select("maxStaff").lean();
  if (school && school.maxStaff !== -1) {
    const activeTeacherCount = await Teacher.countDocuments({ schoolId, isDeleted: { $ne: true } });
    const activeAdminCount = await Admin.countDocuments({ schoolId, isDeleted: { $ne: true }, isSuperAdmin: false });
    
    let activeTransportStaffCount = 0;
    try {
      activeTransportStaffCount = await TransportStaff.countDocuments({ schoolId });
    } catch (e) {
      console.warn("TransportStaff collection not found or failed to count, skipping from staff limit", e.message);
    }

    const totalStaff = activeTeacherCount + activeAdminCount + activeTransportStaffCount;

    if (totalStaff + countToAdd > school.maxStaff) {
      throw new ValidationError(`Staff limit reached. Your plan allows up to ${school.maxStaff} staff members (currently hosting ${totalStaff}). Please upgrade your subscription plan.`);
    }
  }
};

/**
 * Updates the school's used storage count in MB.
 * @param {string} schoolId 
 * @param {number} bytes - Positve to add, negative to subtract.
 */
export const updateStorageUsed = async (schoolId, bytes) => {
  const sizeMB = bytes / (1024 * 1024);
  await School.findByIdAndUpdate(schoolId, { $inc: { storageUsed: sizeMB } });
};
