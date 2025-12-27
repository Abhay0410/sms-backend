// controllers/parent/parent.message.controller.js
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import Message from '../../models/Message.js';

export const getParentThreads = asyncHandler(async (req, res) => {
  const { schoolId, id: parentId } = req.user; // Ensure 'id' matches your JWT payload

  const threads = await Message.find({
    schoolId,
    'participants.userId': parentId,
  })
  .sort({ lastMessageAt: -1 })
  .populate('participants.userId', 'name profilePicture role');

  const processedThreads = threads.map(thread => {
    // Find the participant who is NOT the parent (the Teacher)
    const partner = thread.participants.find(
      p => p.userId?._id.toString() !== parentId.toString()
    );

    return {
      ...thread._doc,
      // ✅ Dynamic Title: If it's a broadcast use title, else use Teacher's Name
      displayTitle: thread.context?.sectionName ? thread.title : (partner ? partner.userId.name : "School Teacher"),
      partnerRole: partner ? partner.userType : 'teacher'
    };
  });

  return successResponse(res, "Parent threads fetched successfully", processedThreads, 200);
});

// Added this function if missing in your routes
export const getParentThreadById = asyncHandler(async (req, res) => {
  const { schoolId, id: parentId } = req.user;
  const { threadId } = req.params;

  // ✅ Added populate to get teacher details for the header
  const thread = await Message.findOne({
    _id: threadId,
    schoolId,
    'participants.userId': parentId,
  }).populate('participants.userId', 'name profilePicture role');

  if (!thread) throw new NotFoundError('Thread not found');

  // ✅ Logic to find the Teacher in the participants list
  const partner = thread.participants.find(
    p => p.userId?._id.toString() !== parentId.toString()
  );

  // ✅ Add displayTitle so the header shows the Teacher's name
  const processedThread = {
    ...thread._doc,
    displayTitle: thread.context?.sectionName ? thread.title : (partner ? partner.userId.name : "School Teacher")
  };

  return successResponse(res, "Thread details fetched", processedThread, 200);
});

export const replyToThreadParent = asyncHandler(async (req, res) => {
  const { schoolId, id: parentId } = req.user;
  const { threadId } = req.params;
  const { message } = req.body;

  if (!message?.trim()) throw new ValidationError('Message is required');

  const thread = await Message.findOne({
    _id: threadId,
    schoolId,
    'participants.userId': parentId,
  });

  if (!thread) throw new NotFoundError('Thread not found');

  thread.messages.push({
    senderType: 'parent',
    senderId: parentId,
    content: message,
  });
  thread.lastMessageAt = new Date();

  await thread.save();
  return successResponse(res, "Reply sent successfully", thread, 200);
});