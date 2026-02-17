import LibraryBook from '../../models/LibraryBook.js';
import LibraryIssue from '../../models/LibraryIssue.js';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// ✅ 1. Add New Book (Single entry)
export const addBook = asyncHandler(async (req, res) => {
  const { title, author, isbn, serialCode, category, subject, rackNumber, price } = req.body;
  const schoolId = req.schoolId;

  // Check if serial code already exists in this school
  const existing = await LibraryBook.findOne({ schoolId, serialCode });
  if (existing) {
    throw new ValidationError(`Book with serial code ${serialCode} already exists in your library.`);
  }

  const book = await LibraryBook.create({
    schoolId,
    title,
    author,
    isbn,
    serialCode,
    category,
    subject,
    rackNumber,
    price,
    status: 'AVAILABLE'
  });

  return successResponse(res, "Book added to inventory successfully", book, 201);
});

// ✅ 2. Get Inventory (With Search & Filters)
export const getInventory = asyncHandler(async (req, res) => {
  const { search, category, status } = req.query;
  const schoolId = req.schoolId;

  const query = { schoolId };

  if (category) query.category = category;
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { author: { $regex: search, $options: 'i' } },
      { serialCode: { $regex: search, $options: 'i' } }
    ];
  }

  const books = await LibraryBook.find(query).sort({ createdAt: -1 });
  return successResponse(res, "Inventory fetched successfully", books);
});

// ✅ 3. Update Book Details
export const updateBook = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schoolId = req.schoolId;

  const book = await LibraryBook.findOneAndUpdate(
    { _id: id, schoolId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!book) throw new NotFoundError("Book");

  return successResponse(res, "Book details updated", book);
});

// ✅ 4. Delete Book
export const deleteBook = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schoolId = req.schoolId;

  const book = await LibraryBook.findOne({ _id: id, schoolId });
  if (!book) throw new NotFoundError("Book");
  
  if (book.status === 'ISSUED') {
    throw new ValidationError("Cannot delete a book that is currently issued to someone.");
  }

  await LibraryBook.deleteOne({ _id: id });
  return successResponse(res, "Book removed from inventory");
});

// ✅ POST: Issue a Book
export const issueBook = asyncHandler(async (req, res) => {
  let { serialCode, userId, userType, dueDate } = req.body;
  const schoolId = req.schoolId;

  // Trim inputs to avoid copy-paste errors
  // Remove quotes (['"]) which might come from barcode scanners or copy-paste
  if (serialCode) serialCode = serialCode.trim().replace(/['"]/g, '');
  if (userId) userId = userId.trim().replace(/['"]/g, '');
  if (userType) userType = userType.toLowerCase().trim();

  // Handle Due Date (Default to 14 days if missing or invalid)
  let finalDueDate;
  if (dueDate) {
    finalDueDate = new Date(dueDate);
  } else {
    finalDueDate = new Date();
    finalDueDate.setDate(finalDueDate.getDate() + 14);
  }

  if (isNaN(finalDueDate.getTime())) throw new ValidationError("Invalid Due Date format");

  // Debug log
  console.log(`Issue Book: Code=${serialCode}, User=${userId}, Type=${userType}, Due=${finalDueDate.toISOString()}`);

  // 1. Find the physical book copy
  const book = await LibraryBook.findOne({ schoolId, serialCode });
  if (!book) throw new NotFoundError(`Book with serial code '${serialCode}'`);
  if (book.status !== 'AVAILABLE') throw new ValidationError("Book is already issued or not available");

  // 2. Verify User (Search by studentID/teacherID OR _id)
  let userData;
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(userId);

  if (userType === 'student') {
    userData = await Student.findOne({ 
      schoolId, 
      $or: [{ studentID: userId }, ...(isMongoId ? [{ _id: userId }] : [])] 
    });
  } else if (userType === 'teacher') {
    userData = await Teacher.findOne({ 
      schoolId, 
      $or: [{ teacherID: userId }, ...(isMongoId ? [{ _id: userId }] : [])] 
    });
  } else {
    throw new ValidationError("Invalid userType. Must be 'student' or 'teacher'");
  }
  
  if (!userData) {
    throw new ValidationError(`User (${userType}) with ID '${userId}' not found in this school.`);
  }

  // 3. Create Issue Record
  const issueRecord = await LibraryIssue.create({
    schoolId,
    bookId: book._id,
    userId: userData._id, // Ensure we store the ObjectId
    userType,
    userName: userData.name,
    issueDate: new Date(),
    dueDate: finalDueDate,
    status: 'ISSUED'
  });

  // 4. Update Book Status
  book.status = 'ISSUED';
  await book.save();

  return successResponse(res, "Book issued successfully", issueRecord);
});

// ✅ 5. Return Book
export const returnBook = asyncHandler(async (req, res) => {
  const { serialCode } = req.body;
  const schoolId = req.schoolId;

  const book = await LibraryBook.findOne({ schoolId, serialCode });
  if (!book) throw new NotFoundError("Book not found");

  const issueRecord = await LibraryIssue.findOne({ 
    schoolId, 
    bookId: book._id, 
    status: 'ISSUED' 
  });

  if (!issueRecord) throw new ValidationError("This book is not currently issued");

  issueRecord.status = 'RETURNED';
  issueRecord.returnDate = new Date();
  await issueRecord.save();

  book.status = 'AVAILABLE';
  await book.save();

  return successResponse(res, "Book returned successfully");
});

// ✅ 6. Get Library Stats
export const getLibraryStats = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  
  const totalIssued = await LibraryIssue.countDocuments({ schoolId, status: 'ISSUED' });
  
  // Count returned today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const totalReturned = await LibraryIssue.countDocuments({ 
    schoolId, 
    status: 'RETURNED', 
    returnDate: { $gte: startOfDay } 
  });
  
  const overdue = await LibraryIssue.countDocuments({ 
    schoolId, 
    status: 'ISSUED', 
    dueDate: { $lt: new Date() } 
  });

  return successResponse(res, "Stats fetched", { totalIssued, totalReturned, overdue });
});

// ✅ 7. Get Recent Transactions
export const getRecentTransactions = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const transactions = await LibraryIssue.find({ schoolId })
    .sort({ updatedAt: -1 })
    .limit(5)
    .populate('bookId', 'title serialCode');
    
  const formatted = transactions.map(t => ({
    type: t.status === 'ISSUED' ? 'ISSUE' : 'RETURN',
    bookTitle: t.bookId?.title || 'Unknown',
    bookCode: t.bookId?.serialCode || 'N/A',
    studentName: t.userName,
    timestamp: t.updatedAt
  }));

  return successResponse(res, "Recent transactions", formatted);
});