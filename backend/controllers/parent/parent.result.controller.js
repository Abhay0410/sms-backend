// controllers/parent/parent.result.controller.js - MULTI-TENANT
import Result from '../../models/Result.js';
import Parent from '../../models/Parent.js';
import Student from '../../models/Student.js';
import PDFDocument from 'pdfkit';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// Get all children results - MULTI-TENANT
export const getAllChildrenResults = asyncHandler(async (req, res) => {
  const parentId = req.user.id;
  
  // ✅ MULTI-TENANT: Get parent's children via Parent model (not direct Student query)
  const parent = await Parent.findOne({
    _id: parentId,
    schoolId: req.schoolId
  }).populate('children', '_id studentID name className section');
  
  if (!parent) {
    throw new NotFoundError('Parent');
  }
  
  const childIds = parent.children.map(c => c._id);
  
  const results = await Result.find({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    student: { $in: childIds },
    isPublished: true
  })
    .populate('student', 'name studentID className section')
    .populate('preparedBy', 'name teacherID')
    .sort({ examYear: -1, createdAt: -1 });
  
  return successResponse(res, 'All children results retrieved', {
    results,
    totalResults: results.length,
    childrenCount: parent.children.length
  });
});

// Get specific child results - MULTI-TENANT (REMOVED BYPASS!)
export const getChildResults = asyncHandler(async (req, res) => {
  const { childId } = req.params;
  const parentId = req.user.id;
  
  console.log("🔍 Parent viewing child results:", childId);
  
  // ✅ MULTI-TENANT: Verify parent-child relationship via Parent model
  const parent = await Parent.findOne({
    _id: parentId,
    schoolId: req.schoolId,
    children: childId  // MongoDB $in check
  }).populate('children', 'name studentID className section');
  
  if (!parent) {
    console.log("❌ Access denied: Child not linked to parent");
    throw new ForbiddenError('Access denied: Child not yours');
  }
  
  const child = parent.children.find(c => c._id.toString() === childId);
  if (!child) {
    throw new NotFoundError('Child not found');
  }
  
  console.log("✅ Child verified:", child.name, child.studentID);
  
  const results = await Result.find({ 
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    student: childId, 
    isPublished: true 
  })
    .populate('preparedBy', 'name teacherID')
    .populate('approvedBy', 'name adminID')
    .sort({ examYear: -1 });
  
  return successResponse(res, 'Child results retrieved', {
    results,
    totalResults: results.length,
    childInfo: {
      name: child.name,
      studentID: child.studentID,
      className: child.className,
      section: child.section
    }
  });
});

// Get result details - MULTI-TENANT
export const getResultDetails = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  const parentId = req.user.id;
  
  const result = await Result.findOne({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    _id: resultId,
    isPublished: true
  })
    .populate('student', 'name studentID rollNumber fatherName motherName dateOfBirth className section')
    .populate('preparedBy', 'name teacherID')
    .populate('approvedBy', 'name adminID');
  
  if (!result) {
    throw new NotFoundError('Result not found or not published');
  }
  
  return successResponse(res, 'Result details retrieved', result);
});

// View result - MULTI-TENANT
export const viewResult = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  const parentId = req.user.id;
  
  const result = await Result.findOne({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    _id: resultId,
    isPublished: true
  })
    .populate('student', 'name studentID rollNumber fatherName motherName dateOfBirth')
    .populate('preparedBy', 'name teacherID')
    .populate('approvedBy', 'name adminID');
  
  if (!result) {
    throw new NotFoundError('Result not found or not published');
  }
  
  return successResponse(res, 'Result viewed successfully', result);
});

// Download result PDF - MULTI-TENANT
export const downloadResult = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  const parentId = req.user.id;
  
  // ✅ MULTI-TENANT: Result + parent-child verification
  const result = await Result.findOne({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    _id: resultId,
    isPublished: true
  }).populate('student', 'name studentID rollNumber fatherName motherName dateOfBirth');
  
  if (!result) {
    throw new NotFoundError('Result not found or not published');
  }
  
  // Verify child belongs to parent
  const parent = await Parent.findOne({
    _id: parentId,
    schoolId: req.schoolId,
    children: result.student._id
  });
  
  if (!parent) {
    throw new ForbiddenError('Access denied');
  }
  
  // [KEEP YOUR EXISTING PDF GENERATION - IDENTICAL TO ORIGINAL]
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Child-Result_${result.studentName}_${result.examType}.pdf"`);
doc.pipe(res);


// Header
 doc.fontSize(24).font('Helvetica-Bold').text('EXAMINATION RESULT', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').text('School Management System', { align: 'center' });
doc.moveDown(2);


// Student Info Box doc.rect(50, doc.y, 500, 140).stroke();
  
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
  doc.text(`DOB: ${result.student.dateOfBirth ? new Date(result.student.dateOfBirth).toLocaleDateString() : 'N/A'}`, 60, infoY);
  
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
  yPos += 20;
  
  // Overall Result
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('OVERALL RESULT', 50, yPos);
  yPos += 25;
  
  doc.font('Helvetica').fontSize(11);
  doc.text(`Total Marks: ${result.totalObtainedMarks + result.totalGraceMarks}/${result.totalMaxMarks}`, 50, yPos);
  yPos += 20;
  doc.text(`Percentage: ${result.overallPercentage}%`, 50, yPos);
  doc.text(`Grade: ${result.overallGrade}`, 250, yPos);
 yPos += 20;
 doc.text(`Division: ${result.division}`, 50, yPos);
doc.text(`Result: ${result.result}`, 250, yPos);


if (result.totalGraceMarks > 0) {
 yPos += 20;
doc.fillColor('red').text(`* Grace Marks: ${result.totalGraceMarks}`, 50, yPos);
 doc.fillColor('black'); }


yPos += 30;
doc.fontSize(12).font('Helvetica-Bold').text('ATTENDANCE', 50, yPos);
 yPos += 20;
doc.font('Helvetica').fontSize(11);
 doc.text(`Days Present: ${result.daysPresent}/${result.totalWorkingDays} (${result.attendancePercentage}%)`, 50, yPos);


if (result.remarks) {
 yPos += 30;
 doc.fontSize(12).font('Helvetica-Bold').text('REMARKS', 50, yPos);
 yPos += 20;
doc.font('Helvetica').fontSize(11).text(result.remarks, 50, yPos, { width: 500 });
}


doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, 50, 750, { align: 'center' });
doc.text('This is a system generated result', { align: 'center' });


 doc.end();
});

export default {
  getAllChildrenResults,
  getChildResults,
  getResultDetails,
  viewResult,
  downloadResult
};
