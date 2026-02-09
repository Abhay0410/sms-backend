// controllers/admin/admin.announcement.controller.js - MULTI-TENANT VERSION
import Announcement from '../../models/Announcement.js';
import School from '../../models/School.js';
import Class from '../../models/Class.js';
import Admin from '../../models/Admin.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { getPaginationParams } from '../../utils/pagination.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all announcements - MULTI-TENANT
export const getAllAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { type, priority, isActive, search } = req.query;
  
  const filter = { schoolId: req.schoolId }; // ✅ MULTI-TENANT
  
  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } }
    ];
  }
  
  const [announcements, total] = await Promise.all([
    Announcement.find(filter)
      .populate('createdBy', 'name email')
      .populate('targetAudience.specificClasses.class', 'className')
      .sort({ isPinned: -1, publishDate: -1 })
      .skip(skip)
      .limit(limit),
    Announcement.countDocuments(filter)
  ]);
  
  return paginatedResponse(res, 'Announcements retrieved successfully', announcements, page, limit, total);
});

// Get classes for announcement targeting - MULTI-TENANT
export const getAnnouncementClasses = asyncHandler(async (req, res) => {
  const { academicYear } = req.query;
  
  const filter = { 
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    ...(academicYear && { academicYear }) 
  };
  
  const classes = await Class.find(filter).select('className sections.sectionName academicYear');
  
  const formattedClasses = classes.map(cls => ({
    id: cls._id,
    className: cls.className,
    academicYear: cls.academicYear,
    sections: cls.sections.map(sec => sec.sectionName)
  }));
  
  return successResponse(res, 'Classes retrieved successfully', formattedClasses);
});

// Create announcement - MULTI-TENANT
export const createAnnouncement = asyncHandler(async (req, res) => {
  const adminId = req.user.id;
  const {
    title, 
    content, 
    type, 
    priority, 
    targetAudience, 
    publishDate, 
    expiryDate, 
    isPinned
  } = req.body;
  
  if (!title || !content) {
    throw new ValidationError('Title and content are required');
  }
  
  const admin = await Admin.findOne({
    _id: adminId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!admin) {
    throw new NotFoundError('Admin');
  }
  
  let parsedTargetAudience = targetAudience;
  if (typeof targetAudience === 'string') {
    try {
      parsedTargetAudience = JSON.parse(targetAudience);
    } catch (e) {
      throw new ValidationError('Invalid target audience format');
    }
  }
  
  if (!parsedTargetAudience || 
      (!parsedTargetAudience.students && 
       !parsedTargetAudience.teachers && 
       !parsedTargetAudience.parents && 
       (!parsedTargetAudience.specificClasses || parsedTargetAudience.specificClasses.length === 0))) {
    throw new ValidationError('At least one target audience must be selected');
  }
  
  // Handle file uploads (local storage)
  let attachments = [];
  if (req.files && req.files.length > 0) {
    console.log(`📎 Processing ${req.files.length} attachments...`);
    
    attachments = req.files.map(file => {
      let fileType = 'raw';
      if (file.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        fileType = 'video';
      } else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) {
        fileType = 'document';
      }
      
      return {
        fileName: file.originalname,
        fileUrl: `/uploads/${req.schoolId}/announcements/${file.filename}`,
        publicId: file.filename,
        fileType,
        fileSize: file.size
      };
    });
    
    console.log(`✅ Processed ${attachments.length} attachments`);
  }
  
  const announcement = new Announcement({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    title,
    content,
    type: type || 'GENERAL',
    priority: priority || 'MEDIUM',
    targetAudience: parsedTargetAudience,
    attachments,
    publishDate: publishDate || new Date(),
    expiryDate,
    isPinned: isPinned || false,
    createdBy: adminId,
    createdByModel: 'Admin',
    createdByName: admin.name,
    isActive: true
  });
  
  await announcement.save();
  await announcement.populate('targetAudience.specificClasses.class', 'className');
  
  return successResponse(res, 'Announcement created successfully', announcement, 201);
});

// Update announcement - MULTI-TENANT
export const updateAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  const announcement = await Announcement.findOne({
    _id: id,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  if (updateData.targetAudience && typeof updateData.targetAudience === 'string') {
    try {
      updateData.targetAudience = JSON.parse(updateData.targetAudience);
    } catch (e) {
      console.warn('Failed to parse targetAudience, keeping existing');
    }
  }
  
  if (req.files && req.files.length > 0) {
    console.log(`📎 Processing ${req.files.length} new attachments...`);
    
    const newAttachments = req.files.map(file => {
      let fileType = 'raw';
      if (file.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        fileType = 'video';
      } else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) {
        fileType = 'document';
      }
      
      return {
        fileName: file.originalname,
        fileUrl: `/uploads/${req.schoolId}/announcements/${file.filename}`,
        publicId: file.filename,
        fileType,
        fileSize: file.size
      };
    });
    
    announcement.attachments.push(...newAttachments);
  }
  
  const allowedFields = ['title', 'content', 'type', 'priority', 'targetAudience', 
                         'publishDate', 'expiryDate', 'isPinned', 'isActive'];
  
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      announcement[field] = updateData[field];
    }
  });
  
  await announcement.save();
  await announcement.populate('targetAudience.specificClasses.class', 'className');
  
  return successResponse(res, 'Announcement updated successfully', announcement);
});

// Delete attachment - MULTI-TENANT
export const deleteAttachment = asyncHandler(async (req, res) => {
  const { announcementId, attachmentId } = req.params;
  
  const announcement = await Announcement.findOne({
    _id: announcementId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  const attachment = announcement.attachments.id(attachmentId);
  if (!attachment) {
    throw new NotFoundError('Attachment');
  }
  
  if (attachment.publicId) {
    const filePath = path.join(__dirname, '../../uploads', req.schoolId.toString(), 'announcements', attachment.publicId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted file: ${attachment.publicId}`);
    }
  }
  
  announcement.attachments.pull(attachmentId);
  await announcement.save();
  
  return successResponse(res, 'Attachment deleted successfully');
});

// Delete announcement - MULTI-TENANT
export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const announcement = await Announcement.findOne({
    _id: id,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  if (announcement.attachments && announcement.attachments.length > 0) {
    for (const attachment of announcement.attachments) {
      if (attachment.publicId) {
        const filePath = path.join(__dirname, '../../uploads', req.schoolId.toString(), 'announcements', attachment.publicId);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted file: ${attachment.publicId}`);
        }
      }
    }
  }
  
  await announcement.deleteOne();
  
  return successResponse(res, 'Announcement deleted successfully');
});

// Pin/Unpin announcement - MULTI-TENANT
export const togglePin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const announcement = await Announcement.findOne({
    _id: id,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  announcement.isPinned = !announcement.isPinned;
  await announcement.save();
  
  return successResponse(
    res, 
    `Announcement ${announcement.isPinned ? 'pinned' : 'unpinned'} successfully`, 
    announcement
  );
});

export default {
  getAllAnnouncements,
  getAnnouncementClasses,
  createAnnouncement,
  updateAnnouncement,
  deleteAttachment,
  deleteAnnouncement,
  togglePin
};
