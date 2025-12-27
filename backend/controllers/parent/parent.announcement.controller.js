// controllers/parent/parent.announcement.controller.js - MULTI-TENANT VERSION
import Announcement from '../../models/Announcement.js';
import Parent from '../../models/Parent.js';
import Student from '../../models/Student.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { NotFoundError } from '../../utils/errors.js';
import { getPaginationParams } from '../../utils/pagination.js';

// Get all announcements for parent (VIEW ONLY) - MULTI-TENANT
export const getAllAnnouncements = asyncHandler(async (req, res) => {
  const parentId = req.user.id;
  const { page, limit, skip } = getPaginationParams(req);
  const { type, priority } = req.query;
  
  // ✅ MULTI-TENANT: Verify parent belongs to school
  const parent = await Parent.findOne({
    _id: parentId,
    schoolId: req.schoolId
  }).populate('children', 'class section className');
  
  if (!parent) {
    throw new NotFoundError('Parent');
  }
  
  // Get unique class IDs and sections from all children
  const childrenInfo = parent.children.map(child => ({
    classId: child.class,
    section: child.section
  }));
  
  const classIds = [...new Set(parent.children.map(child => child.class))];
  
  const filter = {
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true,
    publishDate: { $lte: new Date() },
    $or: [
      // General announcements for all parents
      { 'targetAudience.parents': true },
      
      // Class-specific announcements - all sections
      { 
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: { $in: classIds },
            allSections: true
          }
        }
      },
      
      // Class and section specific announcements
      ...childrenInfo.map(info => ({
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: info.classId,
            allSections: false,
            sections: info.section
          }
        }
      }))
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
  const parentId = req.user.id;
  
  // ✅ MULTI-TENANT: Verify parent belongs to school
  const parent = await Parent.findOne({
    _id: parentId,
    schoolId: req.schoolId
  }).populate('children', 'class section');
  
  if (!parent) {
    throw new NotFoundError('Parent');
  }
  
  const classIds = [...new Set(parent.children.map(child => child.class))];
  const childrenInfo = parent.children.map(child => ({
    classId: child.class,
    section: child.section
  }));
  
  const announcement = await Announcement.findOne({
    _id: announcementId,
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true,
    $or: [
      { 'targetAudience.parents': true },
      { 
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: { $in: classIds },
            allSections: true
          }
        }
      },
      ...childrenInfo.map(info => ({
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: info.classId,
            allSections: false,
            sections: info.section
          }
        }
      }))
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
  const parentId = req.user.id;
  
  // ✅ MULTI-TENANT: Verify both parent and announcement belong to school
  const [parent, announcement] = await Promise.all([
    Parent.findOne({ _id: parentId, schoolId: req.schoolId }),
    Announcement.findOne({ _id: announcementId, schoolId: req.schoolId })
  ]);
  
  if (!parent || !announcement) {
    throw new NotFoundError('Parent or Announcement');
  }
  
  // Check if already read
  const alreadyRead = announcement.readBy.some(
    read => read.user.toString() === parentId && read.readByModel === 'Parent'
  );
  
  if (!alreadyRead) {
    announcement.readBy.push({
      user: parentId,
      readByModel: 'Parent',
      readAt: new Date()
    });
    await announcement.save();
  }
  
  return successResponse(res, 'Announcement marked as read');
});

// Get pinned announcements - MULTI-TENANT
export const getPinnedAnnouncements = asyncHandler(async (req, res) => {
  const parentId = req.user.id;
  
  // ✅ MULTI-TENANT: Verify parent belongs to school
  const parent = await Parent.findOne({
    _id: parentId,
    schoolId: req.schoolId
  }).populate('children', 'class section');
  
  if (!parent) {
    throw new NotFoundError('Parent');
  }
  
  const classIds = [...new Set(parent.children.map(child => child.class))];
  const childrenInfo = parent.children.map(child => ({
    classId: child.class,
    section: child.section
  }));
  
  const announcements = await Announcement.find({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true,
    isPinned: true,
    publishDate: { $lte: new Date() },
    $or: [
      { 'targetAudience.parents': true },
      { 
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: { $in: classIds },
            allSections: true
          }
        }
      },
      ...childrenInfo.map(info => ({
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: info.classId,
            allSections: false,
            sections: info.section
          }
        }
      }))
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

// Get announcements by child - MULTI-TENANT
export const getAnnouncementsByChild = asyncHandler(async (req, res) => {
  const { childId } = req.params;
  const parentId = req.user.id;
  const { page, limit, skip } = getPaginationParams(req);
  
  // ✅ MULTI-TENANT: Verify parent belongs to school
  const parent = await Parent.findOne({
    _id: parentId,
    schoolId: req.schoolId
  }).populate({
    path: 'children',
    match: { _id: childId },  // Only populate matching child
    select: 'class section className'
  });
  
  if (!parent || parent.children.length === 0) {
    throw new NotFoundError('Child not found or access denied');
  }
  
  const child = parent.children[0];
  
  const filter = {
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true,
    publishDate: { $lte: new Date() },
    $or: [
      { 'targetAudience.parents': true },
      { 
        'targetAudience.specificClasses': {
          $elemMatch: {
            class: child.class,
            $or: [
              { allSections: true },
              { allSections: false, sections: child.section }
            ]
          }
        }
      }
    ]
  };
  
  const [announcements, total] = await Promise.all([
    Announcement.find(filter)
      .populate('createdBy', 'name')
      .sort({ isPinned: -1, publishDate: -1 })
      .skip(skip)
      .limit(limit),
    Announcement.countDocuments(filter)
  ]);
  
  const currentDate = new Date();
  const activeAnnouncements = announcements.filter(ann => {
    if (!ann.expiryDate) return true;
    return new Date(ann.expiryDate) >= currentDate;
  });
  
  return paginatedResponse(
    res, 
    'Child announcements retrieved successfully', 
    activeAnnouncements, 
    page, 
    limit, 
    total
  );
});

export default {
  getAllAnnouncements,
  getAnnouncementById,
  markAsRead,
  getPinnedAnnouncements,
  getAnnouncementsByChild
};
