// controllers/teacher/teacher.message.controller.js
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import Message from '../../models/Message.js';
import Student from '../../models/Student.js';
import ClassModel from '../../models/Class.js';
import Teacher from '../../models/Teacher.js';
import Parent from '../../models/Parent.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: build participants array
const buildParticipants = async ({
  schoolId,
  mode,
  targets,
}) => {
  const participants = [];

  if (mode === 'single') {
    const { studentIds = [], parentIds = [] } = targets;
    studentIds.forEach(id => {
      participants.push({ userType: 'student', userTypeRef: 'Student', userId: id });
    });
    parentIds.forEach(id => {
      participants.push({ userType: 'parent', userTypeRef: 'Parent', userId: id });
    });
  }

  if (mode === 'section') {
    const { classId, sectionName, includeStudents, includeParents } = targets;
    const classDoc = await ClassModel.findOne({
      _id: classId,
      schoolId,
      'sections.sectionName': sectionName,
    });
    if (!classDoc) throw new ValidationError('Class/Section not found');

    const students = await Student.find({
      schoolId,
      classId,
      section: sectionName,
    }).select('_id parentId');

    if (includeStudents) {
      students.forEach(s => {
        participants.push({ userType: 'student', userTypeRef: 'Student', userId: s._id });
      });
    }

    if (includeParents) {
      const parentIds = [...new Set(students.map(s => s.parentId).filter(Boolean))];
      parentIds.forEach(pid => {
        participants.push({ userType: 'parent', userTypeRef: 'Parent', userId: pid });
      });
    }
  }

  const uniqueKey = new Set();
  const unique = [];
  for (const p of participants) {
    const key = `${p.userType}:${p.userId}`;
    if (!uniqueKey.has(key)) {
      uniqueKey.add(key);
      unique.push(p);
    }
  }
  return unique;
};

export const getTeacherSections = asyncHandler(async (req, res) => {
  const teacherId = req.user.id || req.user._id;
  const schoolId = req.user.schoolId;

  // 1. Fetch the teacher and populate class details
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: schoolId
  }).populate('assignedClasses.class', 'className');

  if (!teacher) {
    return successResponse(res, "Teacher not found", [], 404);
  }

  // 2. Map the assignedClasses to the format your frontend expects
  const assignedSections = teacher.assignedClasses.map(ac => ({
    classId: ac.class?._id || ac.class,
    className: ac.class?.className || "Unknown Class",
    sectionName: ac.section,
    displayName: `${ac.class?.className || "Class"} - ${ac.section} (${ac.subject})`
  }));

  console.log(`Found ${assignedSections.length} assigned sections for ${teacher.name}`);

  // ✅ Correct successResponse call: res, message, data, statusCode
  return successResponse(res, "Teacher sections fetched successfully", assignedSections, 200);
});

export const getTeacherThreads = asyncHandler(async (req, res) => {
  const { schoolId, id: teacherId } = req.user;

  const threads = await Message.find({
    schoolId,
    'participants.userId': teacherId,
  })
  .sort({ lastMessageAt: -1 })
  .populate('participants.userId', 'name profilePicture role'); // ✅ Added populate

  const processedThreads = threads.map(thread => {
    // If it's a broadcast (Class Section), keep the title as is
    if (thread.context?.sectionName) {
      return { ...thread._doc, displayTitle: thread.title };
    }

    // Find the recipient (the person who is NOT the current teacher)
    const partner = thread.participants.find(
      p => p.userId?._id.toString() !== teacherId.toString()
    );

    return {
      ...thread._doc,
      displayTitle: partner ? partner.userId.name : thread.title,
      partnerRole: partner ? partner.userType : null
    };
  });

  return successResponse(res, "Threads fetched successfully", processedThreads, 200);
});

export const createThreadTeacher = asyncHandler(async (req, res) => {
  const { schoolId, id: teacherId } = req.user; // Changed _id to id to match your JWT payload
  const {
    title, message, mode, studentIds, parentIds, 
    classId, sectionName, includeStudents, includeParents 
  } = req.body;

  // Handle file uploads
  let attachments = [];
  if (req.files && req.files.length > 0) {
    attachments = req.files.map(file => {
      let fileType = 'raw';
      if (file.mimetype.startsWith('image/')) fileType = 'image';
      else if (file.mimetype.startsWith('video/')) fileType = 'video';
      else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) fileType = 'document';
      
      return {
        fileName: file.originalname,
        fileUrl: `/uploads/${req.schoolId}/messages/${file.filename}`,
        publicId: file.filename,
        fileType,
        fileSize: file.size
      };
    });
  }

  if (!message?.trim() && attachments.length === 0) throw new ValidationError('Message content or attachment is required');

  let participants = await buildParticipants({
    schoolId,
    mode,
    targets: { studentIds, parentIds, classId, sectionName, includeStudents, includeParents }
  });

  // Ensure participants have userId
  participants.push({ 
    userType: 'teacher', 
    userTypeRef: 'Teacher', 
    userId: teacherId // This was missing/undefined causing the error
  });

  const thread = await Message.create({
    schoolId,
    participants,
    title: title || (mode === 'section' ? `Section ${sectionName} Broadcast` : 'Direct Message'),
    context: mode === 'section' ? { classId, sectionName } : {},
    messages: [{ 
        senderType: 'teacher', 
        senderId: teacherId, // This was missing causing the error
        content: message,
        attachments
    }],
    createdByType: 'teacher',
    createdById: teacherId, // This was missing causing the error
    isGroup: participants.length > 2,
    lastMessageAt: new Date(),
  });

  return successResponse(res, "Message thread created", thread, 201);
});

// controllers/teacher/teacher.message.controller.js

export const getThreadByIdTeacher = asyncHandler(async (req, res) => {
  const { schoolId, id: teacherId } = req.user;
  const { threadId } = req.params;

  const thread = await Message.findOne({ _id: threadId, schoolId, 'participants.userId': teacherId })
    .populate('participants.userId', 'name profilePicture role');

  if (!thread) throw new NotFoundError('Thread not found');

  // Logic to identify partner for the header
  const partner = thread.participants.find(p => p.userId?._id.toString() !== teacherId.toString());
  const displayTitle = thread.context?.sectionName ? thread.title : (partner ? partner.userId.name : thread.title);

  return successResponse(res, "Thread fetched", { ...thread._doc, displayTitle }, 200);
});

// Reply to thread - FIXED ID and Response
export const replyToThreadTeacher = asyncHandler(async (req, res) => {
  const { schoolId, id: teacherId } = req.user; // Changed _id to id
  const { threadId } = req.params;
  const { message } = req.body;

  const thread = await Message.findOne({ 
    _id: threadId, 
    schoolId, 
    'participants.userId': teacherId 
  });

  if (!thread) throw new NotFoundError('Thread not found');

  // Handle file uploads
  let attachments = [];
  if (req.files && req.files.length > 0) {
    attachments = req.files.map(file => {
      let fileType = 'raw';
      if (file.mimetype.startsWith('image/')) fileType = 'image';
      else if (file.mimetype.startsWith('video/')) fileType = 'video';
      else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) fileType = 'document';
      
      return {
        fileName: file.originalname,
        fileUrl: `/uploads/${req.schoolId}/messages/${file.filename}`,
        publicId: file.filename,
        fileType,
        fileSize: file.size
      };
    });
  }

  thread.messages.push({ 
    senderType: 'teacher', 
    senderId: teacherId, 
    content: message,
    attachments
  });
  thread.lastMessageAt = new Date();
  await thread.save();

  return successResponse(res, "Reply added successfully", thread, 200);
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const { threadId, messageId } = req.params;
  const teacherId = req.user.id;
  const schoolId = req.schoolId;

  const thread = await Message.findOne({ _id: threadId, schoolId });
  if (!thread) throw new NotFoundError('Thread not found');

  const message = thread.messages.id(messageId);
  if (!message) throw new NotFoundError('Message not found');

  // Check ownership
  if (message.senderId.toString() !== teacherId.toString()) {
    throw new ForbiddenError('You can only delete your own messages');
  }

  // Delete attachments
  if (message.attachments && message.attachments.length > 0) {
    message.attachments.forEach(att => {
      if (att.publicId) {
        const filePath = path.join(__dirname, '../../uploads', schoolId.toString(), 'messages', att.publicId);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error("Error deleting message attachment:", e);
          }
        }
      }
    });
  }

  // Remove message
  thread.messages.pull(messageId);
  
  // Update lastMessageAt if needed
  if (thread.messages.length > 0) {
    thread.lastMessageAt = thread.messages[thread.messages.length - 1].createdAt;
  }
  
  await thread.save();

  return successResponse(res, 'Message deleted successfully');
});

export const searchRecipients = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const schoolId = req.user.schoolId;
  const teacherId = req.user.id || req.user._id;

  if (!q || q.length < 1) {
    return successResponse(res, "Query required", [], 200);
  }

  // 1. Get Teacher's assigned class/section context
  const teacher = await Teacher.findById(teacherId).select('assignedClasses');
  if (!teacher) throw new NotFoundError('Teacher not found');

  // Extract just the class IDs from teacher assignments
  const assignedClassIds = teacher.assignedClasses.map(ac => ac.class);

  // 2. Search Students (Filter by teacher's classes for security/relevance)
  const students = await Student.find({
    schoolId,
    class: { $in: assignedClassIds }, // Only students in teacher's classes
    name: { $regex: q, $options: 'i' }
  }).select('name _id studentID section className').limit(10);

  // 3. Search Parents of those students
  const studentIds = students.map(s => s._id);
  const parents = await Parent.find({
    schoolId,
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { children: { $in: studentIds } } // Find parents by child name too
    ]
  }).select('name _id parentID').limit(10);

  const results = [
    ...students.map(s => ({ 
        _id: s._id, 
        name: s.name, 
        type: 'student', 
        sub: `${s.className || 'Class'} - ${s.section || ''}` 
    })),
    ...parents.map(p => ({ 
        _id: p._id, 
        name: p.name, 
        type: 'parent', 
        sub: 'Parent' 
    }))
  ];

  return successResponse(res, "Search results fetched", results, 200);
});