// controllers/student/student.announcement.controller.js - MULTI-TENANT VERSION
import Announcement from '../../models/Announcement.js';
import Student from '../../models/Student.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { NotFoundError } from '../../utils/errors.js';
import { getPaginationParams } from '../../utils/pagination.js';

// Get all announcements for student (VIEW ONLY) - MULTI-TENANT
export const getAllAnnouncements = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { page, limit, skip } = getPaginationParams(req);
  const { type, priority } = req.query;
  
  // ✅ MULTI-TENANT: Verify student belongs to school
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const filter = {
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true,
    publishDate: { $lte: new Date() },
    $or: [
      // General announcements for all students
      { 'targetAudience.students': true },
      
      // Class-specific announcements - all sections
      { 
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: student.class,
            allSections: true
          }
        }
      },
      
      // Class and section specific announcements
      { 
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: student.class,
            allSections: false,
            sections: student.section
          }
        }
      }
    ]
  };
  
  // Add type filter if provided
  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  
  const [announcements, total] = await Promise.all([
    Announcement.find(filter)
      .populate('createdBy', 'name')
      .populate('targetAudience.specificClasses.class', 'className')
      .sort({ isPinned: -1, publishDate: -1 })
      .skip(skip)
      .limit(limit),
    Announcement.countDocuments(filter)
  ]);
  
  // Filter out expired announcements
  const currentDate = new Date();
  const activeAnnouncements = announcements.filter(ann => {
    if (!ann.expiryDate) return true;
    return new Date(ann.expiryDate) >= currentDate;
  });
  
  return paginatedResponse(
    res, 
    'Announcements retrieved successfully', 
    activeAnnouncements, 
    page, 
    limit, 
    total  // Use total from countDocuments
  );
});

// Get announcement by ID - MULTI-TENANT
export const getAnnouncementById = asyncHandler(async (req, res) => {
  const { announcementId } = req.params;
  const studentId = req.user.id;
  
  // ✅ MULTI-TENANT: Verify student belongs to school
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const announcement = await Announcement.findOne({
    _id: announcementId,
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true,
    $or: [
      { 'targetAudience.students': true },
      { 
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: student.class,
            $or: [
              { allSections: true },
              { allSections: false, sections: student.section }
            ]
          }
        }
      }
    ]
  })
    .populate('createdBy', 'name')
    .populate('targetAudience.specificClasses.class', 'className');
  
  if (!announcement) {
    throw new NotFoundError('Announcement not found or not accessible');
  }
  
  // Check if expired
  if (announcement.expiryDate && new Date(announcement.expiryDate) < new Date()) {
    throw new NotFoundError('This announcement has expired');
  }
  
  return successResponse(res, 'Announcement retrieved successfully', announcement);
});

// Mark announcement as read - MULTI-TENANT
export const markAsRead = asyncHandler(async (req, res) => {
  const { announcementId } = req.params;
  const studentId = req.user.id;
  
  // ✅ MULTI-TENANT: Verify both student and announcement belong to school
  const [student, announcement] = await Promise.all([
    Student.findOne({ _id: studentId, schoolId: req.schoolId }),
    Announcement.findOne({ _id: announcementId, schoolId: req.schoolId })
  ]);
  
  if (!student || !announcement) {
    throw new NotFoundError('Student or Announcement');
  }
  
  // Check if already read
  const alreadyRead = announcement.readBy.some(
    read => read.user.toString() === studentId && read.readByModel === 'Student'
  );
  
  if (!alreadyRead) {
    announcement.readBy.push({
      user: studentId,
      readByModel: 'Student',
      readAt: new Date()
    });
    await announcement.save();
  }
  
  return successResponse(res, 'Announcement marked as read');
});

// Get pinned announcements - MULTI-TENANT
export const getPinnedAnnouncements = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  
  // ✅ MULTI-TENANT: Verify student belongs to school
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const announcements = await Announcement.find({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true,
    isPinned: true,
    publishDate: { $lte: new Date() },
    $or: [
      { 'targetAudience.students': true },
      { 
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: student.class,
            $or: [
              { allSections: true },
              { allSections: false, sections: student.section }
            ]
          }
        }
      }
    ]
  })
    .populate('createdBy', 'name')
    .sort({ publishDate: -1 })
    .limit(5);
  
  // Filter out expired
  const currentDate = new Date();
  const activeAnnouncements = announcements.filter(ann => {
    if (!ann.expiryDate) return true;
    return new Date(ann.expiryDate) >= currentDate;
  });
  
  return successResponse(res, 'Pinned announcements retrieved successfully', activeAnnouncements);
});

export default {
  getAllAnnouncements,
  getAnnouncementById,
  markAsRead,
  getPinnedAnnouncements
};
