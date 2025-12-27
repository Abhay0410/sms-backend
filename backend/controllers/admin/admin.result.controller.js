// controllers/admin/admin.result.controller.js - MULTI-TENANT VERSION
import Result from '../../models/Result.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { getPaginationParams } from '../../utils/pagination.js';
import PDFDocument from 'pdfkit';

export const getResultById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Use findOne with both _id and schoolId to ensure multi-tenant security
  const result = await Result.findOne({
    _id: id,
    schoolId: req.schoolId // ✅ Re-enable this to prevent cross-school data leaks
  })
  .populate('student', 'name studentID rollNumber fatherName motherName dateOfBirth')
  .populate('preparedBy', 'name teacherID')
  .populate('approvedBy', 'name')
  .populate('class', 'className');

  // If result is null, it means the ID is wrong OR it belongs to another school
  if (!result) {
    throw new NotFoundError('Result not found or access denied');
  }

  return successResponse(res, 'Result retrieved successfully', result);
});

// Get all results with filters - MULTI-TENANT
export const getAllResults = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { examType, className, section, status: resultStatus, search } = req.query;
  
  const filter = { schoolId: req.schoolId }; // ✅ MULTI-TENANT
  
  if (examType) filter.examType = examType;
  if (className) filter.className = { $regex: className, $options: 'i' };
  if (section) filter.section = section;
  if (resultStatus) filter.result = resultStatus;
  if (search) {
    filter.$or = [
      { studentName: { $regex: search, $options: 'i' } },
      { studentID: { $regex: search, $options: 'i' } },
      { rollNumber: parseInt(search) }
    ];
  }

  const [results, total] = await Promise.all([
    Result.find(filter)
      .populate('student', 'name studentID rollNumber')
      .populate('preparedBy', 'name teacherID')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Result.countDocuments(filter)
  ]);

  return paginatedResponse(res, 'Results retrieved successfully', results, page, limit, total);
});

// Get statistics - MULTI-TENANT
export const getResultStatistics = asyncHandler(async (req, res) => {
  const stats = await Result.aggregate([
    {
      $match: { schoolId: req.schoolId } // ✅ MULTI-TENANT
    },
    {
      $group: {
        _id: null,
        totalResults: { $sum: 1 },
        draftCount: {
          $sum: { $cond: [{ $not: "$isApproved" }, 1, 0] }
        },
        approvedCount: {
          $sum: { 
            $cond: [ 
              { $and: [{ $eq: ["$isApproved", true] }, { $not: "$isPublished" }] }, 
              1, 
              0 
            ] 
          }
        },
        publishedCount: {
          $sum: { $cond: [{ $eq: ["$isPublished", true] }, 1, 0] }
        }
      }
    }
  ]);

  const statData = stats[0] || {};
  return successResponse(res, 'Result statistics retrieved successfully', {
    totalResults: statData.totalResults || 0,
    draftCount: statData.draftCount || 0,
    approvedCount: statData.approvedCount || 0,
    publishedCount: statData.publishedCount || 0
  });
});

// Single approve - MULTI-TENANT
export const approveResult = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  const adminId = req.user.id;
  
  const result = await Result.findOne({
    _id: resultId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!result) throw new NotFoundError('Result');
  if (result.isApproved) throw new ValidationError('Result is already approved');
  
  result.isApproved = true;
  result.approvedBy = adminId;
  result.approvedAt = new Date();
  await result.save();
  
  return successResponse(res, 'Result approved successfully', result);
});

// Single unapprove - MULTI-TENANT
export const unapproveResult = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  
  const result = await Result.findOne({
    _id: resultId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!result) throw new NotFoundError('Result');
  if (!result.isApproved) throw new ValidationError('Result is not approved');
  
  result.isApproved = false;
  result.approvedBy = null;
  result.approvedAt = null;
  result.isPublished = false;
  result.publishedAt = null;
  await result.save();
  
  return successResponse(res, 'Result reverted to draft', result);
});

// Single publish - MULTI-TENANT
export const publishResult = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  
  const result = await Result.findOne({
    _id: resultId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!result) throw new NotFoundError('Result');
  if (!result.isApproved) throw new ValidationError('Result must be approved first');
  if (result.isPublished) throw new ValidationError('Result is already published');
  
  result.isPublished = true;
  result.publishedAt = new Date();
  await result.save();
  
  return successResponse(res, 'Result published successfully', result);
});

// Single unpublish - MULTI-TENANT
export const unpublishResult = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  
  const result = await Result.findOne({
    _id: resultId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!result) throw new NotFoundError('Result');
  if (!result.isPublished) throw new ValidationError('Result is not published');
  
  result.isPublished = false;
  result.publishedAt = null;
  await result.save();
  
  return successResponse(res, 'Result unpublished successfully', result);
});

// Bulk approve - MULTI-TENANT
export const bulkApproveResults = asyncHandler(async (req, res) => {
  const { resultIds } = req.body;
  const adminId = req.user.id;
  
  if (!resultIds || !Array.isArray(resultIds) || resultIds.length === 0) {
    throw new ValidationError('resultIds array is required');
  }
  
  const updateResult = await Result.updateMany(
    { 
      _id: { $in: resultIds }, 
      schoolId: req.schoolId,  // ✅ MULTI-TENANT
      isApproved: false 
    },
    { 
      $set: { 
        isApproved: true, 
        approvedBy: adminId, 
        approvedAt: new Date() 
      } 
    }
  );
  
  return successResponse(res, `${updateResult.modifiedCount} results approved successfully`, {
    approved: updateResult.modifiedCount,
    total: resultIds.length
  });
});

// Bulk publish - MULTI-TENANT
export const bulkPublishResults = asyncHandler(async (req, res) => {
  const { resultIds } = req.body;
  
  if (!resultIds || !Array.isArray(resultIds) || resultIds.length === 0) {
    throw new ValidationError('resultIds array is required');
  }
  
  // Check all are approved - MULTI-TENANT
  const unapprovedCount = await Result.countDocuments({
    _id: { $in: resultIds },
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isApproved: false
  });
  
  if (unapprovedCount > 0) {
    throw new ValidationError(`Cannot publish: ${unapprovedCount} results need approval first`);
  }
  
  const updateResult = await Result.updateMany(
    { 
      _id: { $in: resultIds }, 
      schoolId: req.schoolId,  // ✅ MULTI-TENANT
      isPublished: false 
    },
    { 
      $set: { 
        isPublished: true, 
        publishedAt: new Date() 
      } 
    }
  );
  
  return successResponse(res, `${updateResult.modifiedCount} results published successfully`, {
    published: updateResult.modifiedCount,
    total: resultIds.length
  });
});

// Download PDF - MULTI-TENANT
export const downloadResult = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  
  const result = await Result.findOne({
    _id: resultId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  }).populate('student', 'name studentID rollNumber fatherName motherName dateOfBirth');
  
  if (!result) throw new NotFoundError('Result');
  
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Result_${result.studentName}_${result.examType}.pdf"`);
  doc.pipe(res);
  
  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('EXAMINATION RESULT', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text('School Management System', { align: 'center' });
  doc.moveDown(2);
  
  // Student Info Box
  doc.rect(50, doc.y, 500, 140).stroke();
  let infoY = doc.y + 10;
  doc.fontSize(12).font('Helvetica');
  doc.text(`Name: ${result.studentName}`, 60, infoY);
  doc.text(`Roll Number: ${result.rollNumber}`, 320, infoY);
  
  infoY += 20;
  doc.text(`Class: ${result.className} - ${result.section}`, 60, infoY);
  doc.text(`Student ID: ${result.studentID}`, 320, infoY);
  
  infoY += 20;
  doc.text(`Father's Name: ${result.fatherName || 'N/A'}`, 60, infoY);
  doc.text(`Mother's Name: ${result.motherName || 'N/A'}`, 320, infoY);
  
  infoY += 20;
  doc.text(`DOB: ${result.dob ? new Date(result.dob).toLocaleDateString() : 'N/A'}`, 60, infoY);
  
  infoY += 20;
  doc.text(`Exam: ${result.examType}`, 60, infoY);
  doc.text(`Academic Year: ${result.academicYear}`, 320, infoY);
  
  infoY += 20;
  doc.text(`Exam Month: ${result.examMonth || 'N/A'}`, 60, infoY);
  doc.text(`Year: ${result.examYear}`, 320, infoY);
  
  doc.moveDown(3);
  
  // Subjects Table
  doc.fontSize(14).font('Helvetica-Bold').text('SUBJECT-WISE MARKS', { underline: true });
  doc.moveDown(0.5);
  
  const tableTop = doc.y;
  const colWidths = [150, 70, 70, 50, 70, 60];
  const headers = ['Subject', 'Theory', 'Practical', 'IA', 'Total', 'Grade'];
  
  doc.fontSize(10).font('Helvetica-Bold');
  let xPos = 50;
  headers.forEach((header, i) => {
    doc.text(header, xPos, tableTop, { width: colWidths[i], align: i === 0 ? 'left' : 'center' });
    xPos += colWidths[i];
  });
  
  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
  
  doc.font('Helvetica');
  let yPos = tableTop + 25;
  
  result.subjects.forEach((subject) => {
    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }
    
    xPos = 50;
    doc.text(subject.subjectName, xPos, yPos, { width: colWidths[0] });
    xPos += colWidths[0];
    
    doc.text(subject.theoryMaxMarks > 0 ? `${subject.theoryObtainedMarks}/${subject.theoryMaxMarks}` : 'N/A', xPos, yPos, { width: colWidths[1], align: 'center' });
    xPos += colWidths[1];
    
    doc.text(subject.practicalMaxMarks > 0 ? `${subject.practicalObtainedMarks}/${subject.practicalMaxMarks}` : 'N/A', xPos, yPos, { width: colWidths[2], align: 'center' });
    xPos += colWidths[2];
    
    doc.text(subject.iaMaxMarks > 0 ? `${subject.iaObtainedMarks}/${subject.iaMaxMarks}` : 'N/A', xPos, yPos, { width: colWidths[3], align: 'center' });
    xPos += colWidths[3];
    
    let totalText = `${subject.totalObtainedMarks}/${subject.totalMaxMarks}`;
    if (subject.graceMarks > 0) totalText += `*`;
    doc.text(totalText, xPos, yPos, { width: colWidths[4], align: 'center' });
    xPos += colWidths[4];
    
    doc.text(subject.grade, xPos, yPos, { width: colWidths[5], align: 'center' });
    
    yPos += 25;
  });
  
  doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
  doc.end();
});

export default {
  getAllResults,
  getResultStatistics,
  getResultById,
  approveResult,
  unapproveResult,
  publishResult,
  unpublishResult,
  bulkApproveResults,
  bulkPublishResults,
  downloadResult
};
