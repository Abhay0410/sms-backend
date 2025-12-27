// controllers/student/student.result.controller.js - MULTI-TENANT VERSION
import Result from '../../models/Result.js';
import Student from '../../models/Student.js';
import School from '../../models/School.js'
import PDFDocument from 'pdfkit';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// Get my results - MULTI-TENANT
export const getMyResults = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { academicYear, examType } = req.query;
  
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
    student: studentId,
    isPublished: true
  };
  
  if (academicYear) filter.academicYear = academicYear;
  if (examType) filter.examType = examType;
  
  const results = await Result.find(filter)
    .populate('preparedBy', 'name teacherID')
    .populate('approvedBy', 'name adminID')
    .sort({ examYear: -1, createdAt: -1 });
  
  return successResponse(res, 'Results retrieved successfully', {
    results,
    totalResults: results.length
  });
});

// Get result by ID - MULTI-TENANT
export const getResultById = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { resultId } = req.params;
  
  // ✅ MULTI-TENANT: Verify student belongs to school
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const result = await Result.findOne({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    _id: resultId,
    student: studentId,
    isPublished: true
  })
    .populate('preparedBy', 'name teacherID')
    .populate('approvedBy', 'name adminID');
  
  if (!result) {
    throw new NotFoundError('Result not found or not yet published');
  }
  
  return successResponse(res, 'Result retrieved successfully', result);
});

// View result details - MULTI-TENANT
export const viewResult = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { resultId } = req.params;
  
  // ✅ MULTI-TENANT: Verify student belongs to school
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const result = await Result.findOne({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    _id: resultId,
    student: studentId,
    isPublished: true
  })
    .populate('student', 'name studentID rollNumber fatherName motherName dateOfBirth')
    .populate('preparedBy', 'name teacherID')
    .populate('approvedBy', 'name adminID');
  
  if (!result) {
    throw new NotFoundError('Result not found or not yet published');
  }
  
  return successResponse(res, 'Result details retrieved successfully', result);
});

// Download result as PDF - MULTI-TENANT
export const downloadResult = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { resultId } = req.params;

  // 1) Fetch data in parallel
  const [school, student, result] = await Promise.all([
    School.findById(req.schoolId).lean(),
    Student.findOne({ _id: studentId, schoolId: req.schoolId }),
    Result.findOne({
      schoolId: req.schoolId,
      _id: resultId,
      student: studentId,
      isPublished: true
    }).populate('student', 'name studentID rollNumber fatherName motherName dateOfBirth')
  ]);

  if (!student || !result) {
    throw new NotFoundError('Result not found or not yet published');
  }

  // 2) School Branding Info
  const schoolName = school?.schoolName || "YOUR SCHOOL NAME";
  const schoolPhone = school?.phone || "";
  const schoolEmail = school?.adminEmail || "";
  const schoolAddressLine = [
    school?.address?.city,
    school?.address?.state,
    school?.address?.country,
  ].filter(Boolean).join(", ");

  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // 3) Set Response Headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Result_${result.studentName}_${result.examType}.pdf"`);
  doc.pipe(res);

  // --- UI Colors ---
  const primaryColor = '#1e3a8a'; // Deep Blue
  const secondaryColor = '#475569'; // Slate
  const borderColor = '#cbd5e1';

  // --- Header Section ---
doc.rect(50, 30, 500, 80).fill(primaryColor);

doc
  .fontSize(22)
  .font('Helvetica-Bold')
  .fillColor('white')
  .text(schoolName.toUpperCase(), 50, 45, { 
    width: 500, 
    align: 'center' 
  }); // Center the name

doc
  .fontSize(9)
  .fillColor('#e2e8f0')
  .text(schoolAddressLine || "School Address", 50, 75, { 
    width: 500, 
    align: 'center' 
  }) // Center the address
  .text(
    [schoolPhone && `Phone: ${schoolPhone}`, schoolEmail && `Email: ${schoolEmail}`]
      .filter(Boolean)
      .join(" | "),
    50,
    88,
    { width: 500, align: 'center' } // Center the contact info
  );

  // --- Title ---
  doc.moveDown(3);
  doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text(`${result.examType} EXAMINATION REPORT`, { align: 'center' });
  doc.strokeColor(primaryColor).lineWidth(1).moveTo(200, doc.y).lineTo(400, doc.y).stroke();
  doc.moveDown(1.5);

  // --- Student Information Table (Professional Grid) ---
  const infoY = doc.y;
  doc.rect(50, infoY, 500, 80).stroke(borderColor);
  
  doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
  doc.text('Student Name:', 65, infoY + 15).font('Helvetica').text(result.studentName.toUpperCase(), 150, infoY + 15);
  doc.font('Helvetica-Bold').text('Student ID:', 320, infoY + 15).font('Helvetica').text(result.studentID, 390, infoY + 15);
  
  doc.font('Helvetica-Bold').text('Class:', 65, infoY + 35).font('Helvetica').text(`${result.className} - ${result.section}`, 150, infoY + 35);
  doc.font('Helvetica-Bold').text('Roll No:', 320, infoY + 35).font('Helvetica').text(result.rollNumber.toString(), 390, infoY + 35);

  doc.font('Helvetica-Bold').text('Father\'s Name:', 65, infoY + 55).font('Helvetica').text(result.fatherName || 'N/A', 150, infoY + 55);
  doc.font('Helvetica-Bold').text('Academic Yr:', 320, infoY + 55).font('Helvetica').text(result.academicYear, 390, infoY + 55);

  doc.moveDown(3);

  // --- Subjects Table Title ---
doc.moveDown(3);
doc
  .fillColor(primaryColor)
  .fontSize(12)
  .font('Helvetica-Bold')
  .text('SUBJECT-WISE PERFORMANCE', 50, doc.y, { align: 'left' }); // Set to left alignment
doc.moveDown(0.5);

  const tableTop = doc.y;
  const colWidths = [180, 60, 60, 60, 70, 70];
  const headers = ['Subject', 'Theory', 'Practical', 'IA', 'Total', 'Grade'];

  // Table Header
  doc.rect(50, tableTop, 500, 20).fill('#f1f5f9');
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold');

  let xPos = 60;
  headers.forEach((header, i) => {
    doc.text(header, xPos, tableTop + 6, { width: colWidths[i], align: i === 0 ? 'left' : 'center' });
    xPos += colWidths[i];
  });

  let yPos = tableTop + 20;
  doc.font('Helvetica').fillColor('#000');

  result.subjects.forEach((subject) => {
    // Row line
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, yPos).lineTo(550, yPos).stroke();
    
    doc.text(subject.subjectName, 60, yPos + 8, { width: colWidths[0] });
    doc.text(subject.theoryMaxMarks > 0 ? `${subject.theoryObtainedMarks}/${subject.theoryMaxMarks}` : '-', 240, yPos + 8, { width: colWidths[1], align: 'center' });
    doc.text(subject.practicalMaxMarks > 0 ? `${subject.practicalObtainedMarks}/${subject.practicalMaxMarks}` : '-', 300, yPos + 8, { width: colWidths[2], align: 'center' });
    doc.text(subject.iaMaxMarks > 0 ? `${subject.iaObtainedMarks}/${subject.iaMaxMarks}` : '-', 360, yPos + 8, { width: colWidths[3], align: 'center' });
    
    let totalText = `${subject.totalObtainedMarks}/${subject.totalMaxMarks}`;
    if (subject.graceMarks > 0) totalText += `*`;
    doc.font('Helvetica-Bold').text(totalText, 420, yPos + 8, { width: colWidths[4], align: 'center' });
    doc.text(subject.grade || 'N/A', 490, yPos + 8, { width: colWidths[5], align: 'center' }).font('Helvetica');

    yPos += 25;
    if (yPos > 700) { doc.addPage(); yPos = 50; }
  });

  // --- Final Summary Section ---
  doc.moveDown(2);
  const summaryY = doc.y;

  // Box 1: Performance
  doc.rect(50, summaryY, 245, 70).fill('#f8fafc').stroke(borderColor);
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('FINAL STATISTICS', 60, summaryY + 10);
  doc.fillColor('#000').font('Helvetica').text(`Percentage: ${result.overallPercentage}%`, 60, summaryY + 28);
  doc.text(`Final Grade: ${result.overallGrade}`, 60, summaryY + 43);
  doc.text(`Result: `, 160, summaryY + 43).fillColor(result.result === 'FAIL' ? '#dc2626' : '#16a34a').font('Helvetica-Bold').text(result.result, 195, summaryY + 43);

  // Box 2: Attendance
  doc.fillColor('#000').rect(305, summaryY, 245, 70).fill('#f8fafc').stroke(borderColor);
  doc.fillColor(primaryColor).font('Helvetica-Bold').text('ATTENDANCE', 315, summaryY + 10);
  doc.fillColor('#000').font('Helvetica').text(`Days Present: ${result.daysPresent}/${result.totalWorkingDays}`, 315, summaryY + 28);
  doc.text(`Attendance Rate: ${result.attendancePercentage}%`, 315, summaryY + 43);

  // --- Signatures ---
  doc.moveDown(6);
  const sigY = doc.y;
  doc.strokeColor('#000').lineWidth(1).moveTo(70, sigY).lineTo(200, sigY).stroke();
  doc.moveTo(350, sigY).lineTo(480, sigY).stroke();
  
  doc.fontSize(10).font('Helvetica-Bold').fillColor(secondaryColor);
  doc.text('Class Teacher', 70, sigY + 8, { width: 130, align: 'center' });
  doc.text('Principal Signature', 350, sigY + 8, { width: 130, align: 'center' });

  // --- Footer ---
  doc.fontSize(8).fillColor('#94a3b8').text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 50, 780, { align: 'center' });

  doc.end();
});

// Get result statistics for student - MULTI-TENANT
export const getMyResultStatistics = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const academicYear = req.query.academicYear || getCurrentAcademicYear();
  
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const results = await Result.find({
    schoolId: req.schoolId,
    student: studentId,
    academicYear,
    isPublished: true
  });
  
  const stats = {
    totalExams: results.length,
    passed: results.filter(r => r.result === 'PASS' || r.result === 'PASS_BY_GRACE').length,
    failed: results.filter(r => r.result === 'FAIL').length,
    absent: results.filter(r => r.result === 'ABSENT').length,
    averagePercentage: results.length > 0 ? 
      (results.reduce((sum, r) => sum + parseFloat(r.overallPercentage || 0), 0) / results.length).toFixed(2) : 0,
    bestPerformance: results.length > 0 ? 
      results.reduce((best, r) => parseFloat(r.overallPercentage || 0) > parseFloat(best.overallPercentage || 0) ? r : best) : null,
    subjects: {}
  };
  
  // Calculate subject-wise statistics
  if (results.length > 0) {
    const subjectMap = {};
    
    results.forEach(result => {
      result.subjects.forEach(subject => {
        const subjName = subject.subjectName;
        if (!subjectMap[subjName]) {
          subjectMap[subjName] = {
            name: subjName,
            totalMarks: 0,
            obtainedMarks: 0,
            count: 0,
            grades: []
          };
        }
        
        subjectMap[subjName].totalMarks += subject.totalMaxMarks || 0;
        subjectMap[subjName].obtainedMarks += subject.totalObtainedMarks || 0;
        subjectMap[subjName].count += 1;
        if (subject.grade) subjectMap[subjName].grades.push(subject.grade);
      });
    });
    
    // Calculate averages
    Object.keys(subjectMap).forEach(subjName => {
      const subj = subjectMap[subjName];
      subj.averagePercentage = subj.count > 0 ? 
        ((subj.obtainedMarks / subj.totalMarks) * 100).toFixed(2) : 0;
      subj.averageGrade = calculateAverageGrade(subj.grades);
    });
    
    stats.subjects = subjectMap;
  }
  
  return successResponse(res, 'Result statistics retrieved successfully', stats);
});

// Helper function to calculate average grade
function calculateAverageGrade(grades) {
  if (grades.length === 0) return 'N/A';
  
  const gradePoints = {
    'A+': 10, 'A': 9, 'B+': 8, 'B': 7, 'C+': 6, 
    'C': 5, 'D+': 4, 'D': 3, 'E': 2, 'F': 1
  };
  
  const validGrades = grades.filter(grade => gradePoints[grade]);
  if (validGrades.length === 0) return 'N/A';
  
  const totalPoints = validGrades.reduce((sum, grade) => sum + gradePoints[grade], 0);
  const averagePoint = totalPoints / validGrades.length;
  
  // Convert back to grade
  if (averagePoint >= 9.5) return 'A+';
  if (averagePoint >= 8.5) return 'A';
  if (averagePoint >= 7.5) return 'B+';
  if (averagePoint >= 6.5) return 'B';
  if (averagePoint >= 5.5) return 'C+';
  if (averagePoint >= 4.5) return 'C';
  if (averagePoint >= 3.5) return 'D+';
  if (averagePoint >= 2.5) return 'D';
  if (averagePoint >= 1.5) return 'E';
  return 'F';
}

// Get recent results - MULTI-TENANT
export const getRecentResults = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { limit = 5 } = req.query;
  
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const results = await Result.find({
    schoolId: req.schoolId,
    student: studentId,
    isPublished: true
  })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .select('examType examYear academicYear overallPercentage overallGrade result createdAt');
  
  return successResponse(res, 'Recent results retrieved successfully', {
    results,
    count: results.length
  });
});

// Compare results across exams - MULTI-TENANT
export const compareResults = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { examType1, examType2, academicYear } = req.query;
  
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const filter = {
    schoolId: req.schoolId,
    student: studentId,
    isPublished: true
  };
  
  if (academicYear) filter.academicYear = academicYear;
  
  const results = await Result.find(filter)
    .select('examType examYear academicYear overallPercentage overallGrade result subjects')
    .sort({ examYear: 1 });
  
  if (results.length < 2) {
    return successResponse(res, 'Insufficient results for comparison', {
      message: 'Need at least 2 published results for comparison',
      totalResults: results.length
    });
  }
  
  // Compare specific exams if provided
  let comparison = {};
  if (examType1 && examType2) {
    const result1 = results.find(r => r.examType === examType1);
    const result2 = results.find(r => r.examType === examType2);
    
    if (result1 && result2) {
      comparison = {
        exam1: {
          type: result1.examType,
          year: result1.examYear,
          percentage: result1.overallPercentage,
          grade: result1.overallGrade
        },
        exam2: {
          type: result2.examType,
          year: result2.examYear,
          percentage: result2.overallPercentage,
          grade: result2.overallGrade
        },
        percentageChange: parseFloat(result2.overallPercentage) - parseFloat(result1.overallPercentage),
        improvement: parseFloat(result2.overallPercentage) > parseFloat(result1.overallPercentage) ? 'IMPROVED' : 'DECLINED'
      };
    }
  }
  
  // Overall trend
  const trend = results.map((result, index) => ({
    exam: result.examType,
    year: result.examYear,
    percentage: result.overallPercentage,
    grade: result.overallGrade,
    rank: index + 1
  }));
  
  return successResponse(res, 'Results comparison completed', {
    comparison,
    trend,
    totalExams: results.length,
    bestResult: results.reduce((best, r) => 
      parseFloat(r.overallPercentage) > parseFloat(best.overallPercentage) ? r : best
    ),
    averagePercentage: (results.reduce((sum, r) => sum + parseFloat(r.overallPercentage), 0) / results.length).toFixed(2)
  });
});

// Get performance analysis - MULTI-TENANT
export const getPerformanceAnalysis = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.schoolId
  });
  
  if (!student) {
    throw new NotFoundError('Student');
  }
  
  const results = await Result.find({
    schoolId: req.schoolId,
    student: studentId,
    isPublished: true
  })
    .select('examType examYear academicYear overallPercentage overallGrade result subjects')
    .sort({ examYear: 1 });
  
  if (results.length === 0) {
    return successResponse(res, 'No results available for analysis', {
      message: 'No published results found',
      suggestions: ['Wait for results to be published', 'Contact class teacher']
    });
  }
  
  const analysis = {
    strengths: [],
    weaknesses: [],
    suggestions: [],
    overallSummary: ''
  };
  
  // Analyze subjects
  const subjectPerformance = {};
  
  results.forEach(result => {
    result.subjects.forEach(subject => {
      const subjName = subject.subjectName;
      if (!subjectPerformance[subjName]) {
        subjectPerformance[subjName] = {
          scores: [],
          grades: [],
          totalMarks: 0,
          obtainedMarks: 0
        };
      }
      
      subjectPerformance[subjName].scores.push(
        (subject.totalObtainedMarks / subject.totalMaxMarks) * 100
      );
      subjectPerformance[subjName].grades.push(subject.grade);
      subjectPerformance[subjName].totalMarks += subject.totalMaxMarks;
      subjectPerformance[subjName].obtainedMarks += subject.totalObtainedMarks;
    });
  });
  
  // Identify strengths and weaknesses
  Object.entries(subjectPerformance).forEach(([subject, data]) => {
    const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    
    if (avgScore >= 80) {
      analysis.strengths.push({
        subject,
        averageScore: avgScore.toFixed(2),
        averageGrade: calculateAverageGrade(data.grades)
      });
    } else if (avgScore < 60) {
      analysis.weaknesses.push({
        subject,
        averageScore: avgScore.toFixed(2),
        averageGrade: calculateAverageGrade(data.grades),
        suggestion: `Focus more on ${subject}. Practice regularly.`
      });
    }
  });
  
  // Generate suggestions
  if (analysis.weaknesses.length > 0) {
    analysis.suggestions.push(
      'Focus on improving weak subjects through regular practice.'
    );
  }
  
  if (analysis.strengths.length > 0) {
    analysis.suggestions.push(
      'Maintain performance in strong subjects while improving others.'
    );
  }
  
  const latestResult = results[results.length - 1];
  analysis.overallSummary = `Based on ${results.length} exams, your overall performance is ${latestResult.overallGrade} grade with ${latestResult.overallPercentage}% marks.`;
  
  return successResponse(res, 'Performance analysis completed', analysis);
});

export default {
  getMyResults,
  getResultById,
  viewResult,
  downloadResult,
  getMyResultStatistics,
  getRecentResults,
  compareResults,
  getPerformanceAnalysis
};
