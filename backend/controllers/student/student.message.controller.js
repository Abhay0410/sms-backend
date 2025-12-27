import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import Message from '../../models/Message.js';

export const getStudentThreads = asyncHandler(async (req, res) => {
  const { schoolId, id: studentId } = req.user;

  const threads = await Message.find({
    schoolId,
    'participants.userId': studentId,
  })
  .sort({ lastMessageAt: -1 })
  .populate('participants.userId', 'name profilePicture role')
  .slice('messages', -1);

  const processedThreads = threads.map(thread => {
    // For students, hamesha Teacher ka naam dikhna chahiye agar individual chat hai
    const partner = thread.participants.find(
      p => p.userId?._id.toString() !== studentId.toString()
    );

    return {
      ...thread._doc,
      displayTitle: thread.context?.sectionName ? thread.title : (partner ? partner.userId.name : "Teacher")
    };
  });

  return successResponse(res, "Student threads fetched", processedThreads, 200);
});

export const getStudentThreadById = asyncHandler(async (req, res) => {
  const { schoolId, id: studentId } = req.user; // Use id from token
  const { threadId } = req.params;

  const thread = await Message.findOne({
    _id: threadId,
    schoolId,
    'participants.userId': studentId,
  });

  if (!thread) throw new NotFoundError('Thread not found');

  return successResponse(res, "Thread details fetched", thread, 200);
});

export const replyToThreadStudent = asyncHandler(async (req, res) => {
  const { schoolId, id: studentId } = req.user; // Use id from token
  const { threadId } = req.params;
  const { message } = req.body;

  const thread = await Message.findOne({
    _id: threadId,
    schoolId,
    'participants.userId': studentId,
  });

  if (!thread) throw new NotFoundError('Thread not found');

  thread.messages.push({
    senderType: 'student',
    senderId: studentId,
    content: message,
  });
  thread.lastMessageAt = new Date();

  await thread.save();
  return successResponse(res, "Reply sent", thread, 200);
});