// controllers/teacher/teacher.announcement.controller.js - MULTI-TENANT VERSION
import Announcement from '../../models/Announcement.js';
import Teacher from '../../models/Teacher.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { getPaginationParams } from '../../utils/pagination.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all announcements visible to teacher - MULTI-TENANT
export const getAllAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { type, priority } = req.query;
  
  const filter = {
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true,
    $and: [
      {
        $or: [
          { expiryDate: { $exists: false } },
          { expiryDate: { $gt: new Date() } }
        ]
      },
      {
        $or: [
          { 'targetAudience.teachers': true },
          { 'targetAudience.students': true },
          { 'targetAudience.parents': true }
        ]
      }
    ]
  };
  
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
  
  return paginatedResponse(res, 'Announcements retrieved successfully', announcements, page, limit, total);
});

// Get teacher's assigned sections - MULTI-TENANT
export const getMySections = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  }).populate('assignedClasses.class', 'className sections academicYear');
  
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }
  
  const sections = teacher.assignedClasses?.map(ac => ({
    classId: ac.class._id,
    className: ac.class.className,
    section: ac.section,
    academicYear: ac.class.academicYear,
    role: ac.role || null
  })) || [];
  
  return successResponse(res, 'Sections retrieved successfully', { sections });
});

// Get announcements created by this teacher - MULTI-TENANT
export const getMyAnnouncements = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const { page, limit, skip } = getPaginationParams(req);
  
  const filter = {
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    createdBy: teacherId,
    createdByModel: 'Teacher'
  };
  
  const [announcements, total] = await Promise.all([
    Announcement.find(filter)
      .populate('targetAudience.specificClasses.class', 'className')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Announcement.countDocuments(filter)
  ]);
  
  return paginatedResponse(res, 'Your announcements retrieved successfully', announcements, page, limit, total);
});

// Create announcement - MULTI-TENANT
export const createAnnouncement = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const {
    title, 
    content, 
    type, 
    priority, 
    targetAudience, 
    publishDate, 
    expiryDate
  } = req.body;
  
  console.log('📝 Teacher creating announcement:', { title, teacherId });
  
  if (!title || !content) {
    throw new ValidationError('Title and content are required');
  }
  
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!teacher) {
    throw new NotFoundError('Teacher');
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
       !parsedTargetAudience.parents)) {
    throw new ValidationError('At least one target audience must be selected');
  }
  
  // Validate teacher can only create for assigned classes (if specificClasses used)
  if (parsedTargetAudience.specificClasses && parsedTargetAudience.specificClasses.length > 0) {
    const teacherClassIds = teacher.assignedClasses?.map(ac => ac.class.toString()) || [];
    
    for (const sc of parsedTargetAudience.specificClasses) {
      if (!teacherClassIds.includes(sc.class.toString())) {
        throw new ForbiddenError('You can only create announcements for your assigned classes');
      }
    }
  }
  
  // Handle file uploads
  let attachments = [];
  if (req.files && req.files.length > 0) {
    console.log(`📎 Processing ${req.files.length} attachments...`);
    
    attachments = req.files.map(file => {
      let fileType = 'raw';
      if (file.mimetype.startsWith('image/')) fileType = 'image';
      else if (file.mimetype.startsWith('video/')) fileType = 'video';
      else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) fileType = 'document';
      
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
    isPinned: false, // Teachers cannot pin announcements
    createdBy: teacherId,
    createdByModel: 'Teacher',
    createdByName: teacher.name,
    isActive: true
  });
  
  await announcement.save();
  await announcement.populate('targetAudience.specificClasses.class', 'className');
  
  console.log('✅ Announcement created:', announcement._id);
  
  return successResponse(res, 'Announcement created successfully', announcement, 201);
});

// Delete announcement (only own) - MULTI-TENANT
export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id;
  
  console.log('🗑️ Teacher deleting announcement:', { id, teacherId });
  
  const announcement = await Announcement.findOne({
    _id: id,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  // Check ownership
  if (announcement.createdBy.toString() !== teacherId.toString()) {
    throw new ForbiddenError('You can only delete your own announcements');
  }
  
  // Delete attachments from filesystem
  if (announcement.attachments && announcement.attachments.length > 0) {
    for (const attachment of announcement.attachments) {
      if (attachment.publicId) {
        const filePath = path.join(__dirname, '../../uploads', req.schoolId.toString(), 'announcements', attachment.publicId);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted file: ${attachment.publicId}`);
          } catch (err) {
            console.error(`❌ Error deleting file: ${attachment.publicId}`, err);
          }
        }
      }
    }
  }
  
  await announcement.deleteOne();
  
  console.log('✅ Announcement deleted');
  
  return successResponse(res, 'Announcement deleted successfully');
});

// Delete attachment from announcement - MULTI-TENANT
export const deleteAttachment = asyncHandler(async (req, res) => {
  const { announcementId, attachmentId } = req.params;
  const teacherId = req.user.id;
  
  const announcement = await Announcement.findOne({
    _id: announcementId,
    schoolId: req.schoolId
  });
  
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  // Check ownership
  if (announcement.createdBy.toString() !== teacherId.toString()) {
    throw new ForbiddenError('You can only delete attachments from your own announcements');
  }
  
  const attachment = announcement.attachments.id(attachmentId);
  if (!attachment) {
    throw new NotFoundError('Attachment');
  }
  
  if (attachment.publicId) {
    const filePath = path.join(__dirname, '../../uploads', req.schoolId.toString(), 'announcements', attachment.publicId);
    
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted file: ${attachment.publicId}`);
      } catch (err) {
        console.error(`❌ Error deleting file: ${attachment.publicId}`, err);
      }
    }
  }
  
  announcement.attachments.pull(attachmentId);
  await announcement.save();
  
  return successResponse(res, 'Attachment deleted successfully');
});

// Update announcement - MULTI-TENANT
export const updateAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id;
  const updateData = req.body;
  
  const announcement = await Announcement.findOne({
    _id: id,
    schoolId: req.schoolId
  });
  
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  // Check ownership
  if (announcement.createdBy.toString() !== teacherId.toString()) {
    throw new ForbiddenError('You can only update your own announcements');
  }
  
  if (updateData.targetAudience && typeof updateData.targetAudience === 'string') {
    try {
      updateData.targetAudience = JSON.parse(updateData.targetAudience);
    } catch (e) {
      throw new ValidationError('Invalid target audience format');
    }
  }
  
  // Handle file uploads
  if (req.files && req.files.length > 0) {
    const newAttachments = req.files.map(file => {
      let fileType = 'raw';
      if (file.mimetype.startsWith('image/')) fileType = 'image';
      else if (file.mimetype.startsWith('video/')) fileType = 'video';
      else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) fileType = 'document';
      
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
  
  const allowedFields = ['title', 'content', 'type', 'priority', 'targetAudience', 'publishDate', 'expiryDate'];
  
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      announcement[field] = updateData[field];
    }
  });
  
  await announcement.save();
  await announcement.populate('targetAudience.specificClasses.class', 'className');
  
  return successResponse(res, 'Announcement updated successfully', announcement);
});

// Toggle pin status - MULTI-TENANT
export const togglePin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id;
  
  const announcement = await Announcement.findOne({
    _id: id,
    schoolId: req.schoolId
  });
  
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  // Check ownership
  if (announcement.createdBy.toString() !== teacherId.toString()) {
    throw new ForbiddenError('You can only pin/unpin your own announcements');
  }
  
  announcement.isPinned = !announcement.isPinned;
  await announcement.save();
  
  return successResponse(res, `Announcement ${announcement.isPinned ? 'pinned' : 'unpinned'} successfully`, announcement);
});

export default {
  getAllAnnouncements,
  getMySections,
  getMyAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  deleteAttachment,
  updateAnnouncement,
  togglePin
};
