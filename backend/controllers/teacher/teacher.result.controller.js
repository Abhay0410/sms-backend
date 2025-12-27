// controllers/teacher/teacher.result.controller.js - MULTI-TENANT VERSION
import Result from "../../models/Result.js";
import Student from "../../models/Student.js";
import Class from "../../models/Class.js";
import Teacher from "../../models/Teacher.js";
import PDFDocument from 'pdfkit';
import { successResponse } from "../../utils/response.js";
import { ValidationError, NotFoundError, ForbiddenError } from "../../utils/errors.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// Get sections for result - MULTI-TENANT
export const getSectionsForResult = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const { academicYear = getCurrentAcademicYear() } = req.query;
  
  console.log("📚 Getting sections for result creation");
  
  // ✅ MULTI-TENANT: Verify teacher belongs to school
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId
  });
  
  if (!teacher) {
    throw new NotFoundError("Teacher");
  }
  
  const classes = await Class.find({ 
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    academicYear, 
    $or: [
      { "sections.classTeacher": teacherId }, 
      { "sections.subjects.teacher": teacherId }
    ] 
  }).select("className sections academicYear");
  
  const sectionsData = [];
  classes.forEach(cls => {
    cls.sections.forEach(section => {
      const isClassTeacher = section.classTeacher?.toString() === teacherId;
      const teachesSubject = section.subjects.some(sub => sub.teacher?.toString() === teacherId);
      
      if (isClassTeacher || teachesSubject) {
        sectionsData.push({ 
          classId: cls._id, 
          className: cls.className, 
          sectionId: section._id, 
          sectionName: section.sectionName, 
          subjects: section.subjects.map(sub => ({ 
            subjectName: sub.subjectName, 
            subjectCode: sub.subjectCode || "", 
            hasTheory: sub.hasTheory !== false, 
            hasPractical: sub.hasPractical === true, 
            hasIA: sub.hasIA !== false,
            theoryMaxMarks: sub.theoryMaxMarks || 100,
            practicalMaxMarks: sub.practicalMaxMarks || 0,
            iaMaxMarks: sub.iaMaxMarks || 20
          })), 
          totalStudents: section.currentStrength 
        });
      }
    });
  });
  
  return successResponse(res, "Sections retrieved successfully", { 
    sections: sectionsData, 
    totalSections: sectionsData.length 
  });
});

// Get students for result - MULTI-TENANT
export const getStudentsForResult = asyncHandler(async (req, res) => {
  const { classId, section } = req.query;
  const academicYear = req.query.academicYear || getCurrentAcademicYear();
  
  if (!classId || !section) throw new ValidationError("Class and section are required");
  
  const students = await Student.find({ 
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    class: classId, 
    section, 
    academicYear, 
    status: "ENROLLED" 
  })
  .select("name studentID rollNumber fatherName motherName dateOfBirth email")
  .sort({ rollNumber: 1 });
  
  return successResponse(res, "Students retrieved successfully", { 
    students: students.map(s => ({ 
      id: s._id, 
      name: s.name, 
      studentID: s.studentID, 
      rollNumber: s.rollNumber, 
      fatherName: s.fatherName, 
      motherName: s.motherName, 
      dateOfBirth: s.dateOfBirth 
    })), 
    totalStudents: students.length 
  });
});

// Create result - MULTI-TENANT
export const createResult = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const { 
    studentId,
    classId,
    className,
    section,
    examType,
    examName,
    examMonth,
    examYear,
    subjects,
    totalWorkingDays,
    daysPresent,
    remarks 
  } = req.body;

  console.log("📝 Creating result for student:", studentId);

  // Basic validation
  if (!studentId || !classId || !examType || !subjects || subjects.length === 0) {
    throw new ValidationError("Student, class, exam type, and subjects are required");
  }

  const academicYear = getCurrentAcademicYear();

  // ✅ MULTI-TENANT: Fetch student and teacher with school verification
  const [student, teacher] = await Promise.all([
    Student.findOne({
      _id: studentId,
      schoolId: req.schoolId
    }).select("name studentID rollNumber fatherName motherName dateOfBirth"),
    Teacher.findOne({
      _id: teacherId,
      schoolId: req.schoolId
    }).select("name teacherID")
  ]);

  if (!student) throw new NotFoundError("Student");
  if (!teacher) throw new NotFoundError("Teacher");

  // 🔒 Ensure this teacher is class teacher of this class + section
  const cls = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  }).select("className sections");
  
  if (!cls) {
    throw new NotFoundError("Class");
  }

  const targetSection = cls.sections.find(
    (sec) =>
      sec.sectionName === section ||
      sec._id?.toString() === section?.toString()
  );

  if (!targetSection) {
    throw new ValidationError("Invalid section for this class");
  }

  const isClassTeacher =
    targetSection.classTeacher &&
    targetSection.classTeacher.toString() === teacherId.toString();

  if (!isClassTeacher) {
    throw new ForbiddenError(
      "Only the class teacher can create results for this class and section"
    );
  }

  // Check if result already exists for this exam
  const existingResult = await Result.findOne({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    student: studentId,
    examType,
    academicYear,
    class: classId,
    section,
  });

  if (existingResult) {
    throw new ValidationError(
      `Result for ${examType} already exists for this student. Please edit the existing result.`
    );
  }

  // Compute subject-wise and overall stats
  let totalMaxMarks = 0;
  let totalObtainedMarks = 0;
  let totalGraceMarks = 0;
  let hasAnyFailure = false;
  let hasAnyAbsent = false;

  const processedSubjects = subjects.map((subject) => {
    const theoryObt = Number(subject.theoryObtainedMarks) || 0;
    const practicalObt = Number(subject.practicalObtainedMarks) || 0;
    const iaObt = Number(subject.iaObtainedMarks) || 0;
    const graceMarks = Number(subject.graceMarks) || 0;

    const theoryMax = Number(subject.theoryMaxMarks) || 0;
    const practicalMax = Number(subject.practicalMaxMarks) || 0;
    const iaMax = Number(subject.iaMaxMarks) || 0;

    const subjectTotal = theoryObt + practicalObt + iaObt;
    const subjectMax = theoryMax + practicalMax + iaMax;

    totalMaxMarks += subjectMax;
    totalObtainedMarks += subjectTotal;
    totalGraceMarks += graceMarks;

    const percentage =
      subjectMax > 0
        ? ((subjectTotal / subjectMax) * 100).toFixed(2)
        : 0;

    let grade = "-";
    if (!subject.isAbsent) {
      const pct = Number(percentage);
      if (pct >= 90) grade = "A+";
      else if (pct >= 80) grade = "A";
      else if (pct >= 70) grade = "B+";
      else if (pct >= 60) grade = "B";
      else if (pct >= 50) grade = "C+";
      else if (pct >= 40) grade = "C";
      else if (pct >= 33) grade = "D";
      else if (pct >= 25) grade = "E";
      else grade = "F";
    }

    let status = subject.status || "FAIL";
    if (subject.isAbsent) {
      status = "ABSENT";
      hasAnyAbsent = true;
    } else if (status === "FAIL") {
      hasAnyFailure = true;
    }

    return {
      ...subject,
      theoryObtainedMarks: theoryObt,
      practicalObtainedMarks: practicalObt,
      iaObtainedMarks: iaObt,
      theoryMaxMarks: theoryMax,
      practicalMaxMarks: practicalMax,
      iaMaxMarks: iaMax,
      graceMarks: graceMarks,
      totalMaxMarks: subjectMax,
      totalObtainedMarks: subjectTotal,
      percentage: Number(percentage),
      grade,
      status,
    };
  });

  const overallPercentage =
    totalMaxMarks > 0
      ? (
          ((totalObtainedMarks + totalGraceMarks) / totalMaxMarks) *
          100
        ).toFixed(2)
      : 0;

  let overallGrade = "F";
  const pct = Number(overallPercentage);
  if (pct >= 90) overallGrade = "A+";
  else if (pct >= 80) overallGrade = "A";
  else if (pct >= 70) overallGrade = "B+";
  else if (pct >= 60) overallGrade = "B";
  else if (pct >= 50) overallGrade = "C+";
  else if (pct >= 40) overallGrade = "C";
  else if (pct >= 33) overallGrade = "D";
  else if (pct >= 25) overallGrade = "E";

  let finalResult = "FAIL";
  if (hasAnyAbsent) {
    finalResult = "ABSENT";
  } else if (!hasAnyFailure) {
    const hasGrace = processedSubjects.some(
      (s) => s.status === "PASS_BY_GRACE"
    );
    finalResult = hasGrace ? "PASS_BY_GRACE" : "PASS";
  }

  let division = "FAIL";
  if (finalResult === "PASS" || finalResult === "PASS_BY_GRACE") {
    if (pct >= 60) division = "FIRST";
    else if (pct >= 50) division = "SECOND";
    else if (pct >= 33) division = "THIRD";
  }

  const result = new Result({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    student: studentId,
    studentName: student.name,
    studentID: student.studentID,
    rollNumber: student.rollNumber,
    fatherName: student.fatherName,
    motherName: student.motherName,
    dob: student.dateOfBirth,
    class: classId,
    className,
    section,
    examType,
    examName: examName || `${examType} ${examYear}`,
    academicYear,
    examMonth,
    examYear: Number(examYear) || new Date().getFullYear(),
    subjects: processedSubjects,
    totalMaxMarks: Number(totalMaxMarks),
    totalObtainedMarks: Number(totalObtainedMarks),
    totalGraceMarks: Number(totalGraceMarks),
    overallPercentage: Number(overallPercentage),
    overallGrade,
    result: finalResult,
    division,
    totalWorkingDays: Number(totalWorkingDays) || 0,
    daysPresent: Number(daysPresent) || 0,
    attendancePercentage:
      totalWorkingDays > 0
        ? Number(
            ((daysPresent / totalWorkingDays) * 100).toFixed(2)
          )
        : 0,
    preparedBy: teacherId,
    preparedByName: teacher.name,
    remarks,
    isApproved: false,
    isPublished: false,
  });

  await result.save();
  console.log("✅ Result created successfully");
  return successResponse(res, "Result created successfully", result, 201);
});

export const getResultById = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  const teacherId = req.user.id;
  
  console.log("📖 Fetching result:", resultId);
  
  // ✅ MULTI-TENANT: First verify teacher exists
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId
  });
  
  if (!teacher) {
    throw new NotFoundError("Teacher not found");
  }
  
  const result = await Result.findOne({
    _id: resultId,
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    preparedBy: teacherId  // ✅ Ensure teacher can only access their own results
  })
  .populate("student", "name studentID rollNumber fatherName motherName dateOfBirth");
  
  if (!result) {
    throw new NotFoundError("Result not found or you don't have permission to view it");
  }
  
  return successResponse(res, "Result retrieved successfully", result);
});

export const updateResult = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  const teacherId = req.user.id;
  const { subjects, totalWorkingDays, daysPresent, remarks, examName, examMonth } = req.body;
  
  console.log("✏️ Updating result:", resultId);
  
  const result = await Result.findOne({
    _id: resultId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!result) throw new NotFoundError("Result");
  
  if (result.preparedBy.toString() !== teacherId) {
    throw new ForbiddenError("You are not authorized to update this result");
  }
  
  // ✅ IMPORTANT: Only allow edit if NOT APPROVED
  if (result.isApproved) {
    throw new ValidationError("Cannot update approved result. Ask admin to revert to draft.");
  }
  
  let totalMaxMarks = 0;
  let totalObtainedMarks = 0;
  let totalGraceMarks = 0;
  let hasAnyFailure = false;
  let hasAnyAbsent = false;
  
  const processedSubjects = subjects.map(subject => {
    const theoryObt = Number(subject.theoryObtainedMarks) || 0;
    const practicalObt = Number(subject.practicalObtainedMarks) || 0;
    const iaObt = Number(subject.iaObtainedMarks) || 0;
    const graceMarks = Number(subject.graceMarks) || 0;
    
    const theoryMax = Number(subject.theoryMaxMarks) || 0;
    const practicalMax = Number(subject.practicalMaxMarks) || 0;
    const iaMax = Number(subject.iaMaxMarks) || 0;
    
    const subjectTotal = theoryObt + practicalObt + iaObt;
    const subjectMax = theoryMax + practicalMax + iaMax;
    
    totalMaxMarks += subjectMax;
    totalObtainedMarks += subjectTotal;
    totalGraceMarks += graceMarks;
    
    const percentage = subjectMax > 0 ? ((subjectTotal / subjectMax) * 100).toFixed(2) : 0;
    
    let grade = '-';
    if (!subject.isAbsent) {
      const pct = Number(percentage);
      if (pct >= 90) grade = 'A+';
      else if (pct >= 80) grade = 'A';
      else if (pct >= 70) grade = 'B+';
      else if (pct >= 60) grade = 'B';
      else if (pct >= 50) grade = 'C+';
      else if (pct >= 40) grade = 'C';
      else if (pct >= 33) grade = 'D';
      else if (pct >= 25) grade = 'E';
      else grade = 'F';
    }
    
    let status = subject.status || 'FAIL';
    if (subject.isAbsent) {
      status = 'ABSENT';
      hasAnyAbsent = true;
    } else if (status === 'FAIL') {
      hasAnyFailure = true;
    }
    
    return {
      ...subject,
      theoryObtainedMarks: theoryObt,
      practicalObtainedMarks: practicalObt,
      iaObtainedMarks: iaObt,
      theoryMaxMarks: theoryMax,
      practicalMaxMarks: practicalMax,
      iaMaxMarks: iaMax,
      graceMarks: graceMarks,
      totalMaxMarks: subjectMax,
      totalObtainedMarks: subjectTotal,
      percentage: Number(percentage),
      grade,
      status
    };
  });
  
  const overallPercentage = totalMaxMarks > 0 ? 
    (((totalObtainedMarks + totalGraceMarks) / totalMaxMarks) * 100).toFixed(2) : 0;
  
  let overallGrade = 'F';
  const pct = Number(overallPercentage);
  if (pct >= 90) overallGrade = 'A+';
  else if (pct >= 80) overallGrade = 'A';
  else if (pct >= 70) overallGrade = 'B+';
  else if (pct >= 60) overallGrade = 'B';
  else if (pct >= 50) overallGrade = 'C+';
  else if (pct >= 40) overallGrade = 'C';
  else if (pct >= 33) overallGrade = 'D';
  else if (pct >= 25) overallGrade = 'E';
  
  let finalResult = 'FAIL';
  if (hasAnyAbsent) {
    finalResult = 'ABSENT';
  } else if (!hasAnyFailure) {
    const hasGrace = processedSubjects.some(s => s.status === 'PASS_BY_GRACE');
    finalResult = hasGrace ? 'PASS_BY_GRACE' : 'PASS';
  }
  
  let division = 'FAIL';
  if (finalResult === 'PASS' || finalResult === 'PASS_BY_GRACE') {
    if (pct >= 60) division = 'FIRST';
    else if (pct >= 50) division = 'SECOND';
    else if (pct >= 33) division = 'THIRD';
  }
  
  result.history.push({
    modifiedAt: new Date(),
    modifiedBy: teacherId,
    changes: JSON.stringify({
      oldMarks: result.totalObtainedMarks,
      newMarks: totalObtainedMarks,
      oldPercentage: result.overallPercentage,
      newPercentage: overallPercentage
    })
  });
  
  result.subjects = processedSubjects;
  result.totalMaxMarks = Number(totalMaxMarks);
  result.totalObtainedMarks = Number(totalObtainedMarks);
  result.totalGraceMarks = Number(totalGraceMarks);
  result.overallPercentage = Number(overallPercentage);
  result.overallGrade = overallGrade;
  result.result = finalResult;
  result.division = division;
  result.totalWorkingDays = Number(totalWorkingDays) || result.totalWorkingDays;
  result.daysPresent = Number(daysPresent) || result.daysPresent;
  result.attendancePercentage = result.totalWorkingDays > 0 ? 
    Number(((result.daysPresent / result.totalWorkingDays) * 100).toFixed(2)) : 0;
  
  if (examName) result.examName = examName;
  if (examMonth) result.examMonth = examMonth;
  if (remarks !== undefined) result.remarks = remarks;
  
  result.version += 1;
  
  await result.save();
  
  console.log("✅ Result updated successfully");
  return successResponse(res, "Result updated successfully", result);
});

export const getResultsByTeacher = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const { examType, academicYear = getCurrentAcademicYear(), classId, section, page = 1, limit = 20 } = req.query;
  
  console.log("👨‍🏫 Fetching results for teacher:", teacherId);
  
  // ✅ MULTI-TENANT: First verify teacher exists in this school
  const teacher = await Teacher.findOne({
    _id: teacherId,
    schoolId: req.schoolId
  });
  
  if (!teacher) {
    throw new NotFoundError("Teacher not found in this school");
  }
  
  const filter = { 
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    preparedBy: teacherId, 
    academicYear 
  };
  
  if (examType) filter.examType = examType;
  if (classId) filter.class = classId;
  if (section) filter.section = section;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [results, total] = await Promise.all([
    Result.find(filter)
      .populate("student", "name studentID rollNumber")
      .populate("class", "className")  // ✅ ADD THIS to populate class name if needed
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Result.countDocuments(filter)
  ]);
  
  console.log(`✅ Found ${results.length} results for teacher ${teacherId}`);
  
  return successResponse(res, "Results retrieved successfully", { 
    results, 
    pagination: { 
      currentPage: parseInt(page), 
      perPage: parseInt(limit), 
      total, 
      totalPages: Math.ceil(total / parseInt(limit)) 
    } 
  });
});

export const getApprovedResults = asyncHandler(async (req, res) => {
  const { examType, academicYear = getCurrentAcademicYear(), classId, section, page = 1, limit = 50 } = req.query;
  
  const filter = { 
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isApproved: true, 
    isPublished: true, 
    academicYear 
  };
  
  if (examType) filter.examType = examType;
  if (classId) filter.class = classId;
  if (section) filter.section = section;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [results, total] = await Promise.all([
    Result.find(filter)
      .populate("student", "name studentID rollNumber")
      .sort({ className: 1, section: 1, rollNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Result.countDocuments(filter)
  ]);
  
  return successResponse(res, "Approved results retrieved successfully", { 
    results, 
    pagination: { 
      currentPage: parseInt(page), 
      perPage: parseInt(limit), 
      total, 
      totalPages: Math.ceil(total / parseInt(limit)) 
    } 
  });
});

export const deleteResult = asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  const teacherId = req.user.id;
  
  const result = await Result.findOne({
    _id: resultId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!result) throw new NotFoundError("Result");
  
  if (result.preparedBy.toString() !== teacherId) {
    throw new ForbiddenError("You are not authorized to delete this result");
  }
  
  // ✅ Only allow deletion if NOT APPROVED
  if (result.isApproved) {
    throw new ValidationError("Cannot delete approved result");
  }
  
  await result.deleteOne();
  return successResponse(res, "Result deleted successfully");
});

// Download result as PDF - MULTI-TENANT
export const downloadResult = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  const { resultId } = req.params;

  const result = await Result.findOne({
    _id: resultId,
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    preparedBy: teacherId,
  }).populate('student', 'name studentID rollNumber fatherName motherName dateOfBirth');

  if (!result) {
    throw new NotFoundError("Result");
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Result_${result.studentName}_${result.examType}.pdf"`);
  
  doc.pipe(res);
  
  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('EXAMINATION RESULT', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text('School Management System', { align: 'center' });
  doc.moveDown(2);
  
  // Student Info
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
  doc.text(`DOB: ${result.student?.dateOfBirth ? new Date(result.student.dateOfBirth).toLocaleDateString() : 'N/A'}`, 60, infoY);
  
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
    
    doc.text(subject.theoryMaxMarks > 0 ? `${subject.theoryObtainedMarks || 0}/${subject.theoryMaxMarks}` : 'N/A', 
             xPos, yPos, { width: colWidths[1], align: 'center' });
    xPos += colWidths[1];
    
    doc.text(subject.practicalMaxMarks > 0 ? `${subject.practicalObtainedMarks || 0}/${subject.practicalMaxMarks}` : 'N/A', 
             xPos, yPos, { width: colWidths[2], align: 'center' });
    xPos += colWidths[2];
    
    doc.text(subject.iaMaxMarks > 0 ? `${subject.iaObtainedMarks || 0}/${subject.iaMaxMarks}` : 'N/A', 
             xPos, yPos, { width: colWidths[3], align: 'center' });
    xPos += colWidths[3];
    
    let totalText = `${subject.totalObtainedMarks || 0}/${subject.totalMaxMarks || 0}`;
    if (subject.graceMarks > 0) totalText += `*`;
    doc.text(totalText, xPos, yPos, { width: colWidths[4], align: 'center' });
    xPos += colWidths[4];
    
    doc.text(subject.grade || 'N/A', xPos, yPos, { width: colWidths[5], align: 'center' });
    
    yPos += 25;
  });
  
  doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
  yPos += 20;
  
  // Overall Result
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('OVERALL RESULT', 50, yPos);
  yPos += 25;
  
  doc.font('Helvetica').fontSize(11);
  doc.text(`Total Marks: ${(result.totalObtainedMarks || 0) + (result.totalGraceMarks || 0)}/${result.totalMaxMarks || 0}`, 
           50, yPos);
  yPos += 20;
  doc.text(`Percentage: ${result.overallPercentage || 0}%`, 50, yPos);
  doc.text(`Grade: ${result.overallGrade || 'N/A'}`, 250, yPos);
  yPos += 20;
  doc.text(`Division: ${result.division || 'N/A'}`, 50, yPos);
  doc.text(`Result: ${result.result || 'N/A'}`, 250, yPos);
  
  if (result.totalGraceMarks > 0) {
    yPos += 20;
    doc.fillColor('red').text(`* Grace Marks: ${result.totalGraceMarks}`, 50, yPos);
    doc.fillColor('black');
  }
  
  yPos += 30;
  doc.fontSize(12).font('Helvetica-Bold').text('ATTENDANCE', 50, yPos);
  yPos += 20;
  doc.font('Helvetica').fontSize(11);
  doc.text(`Days Present: ${result.daysPresent || 0}/${result.totalWorkingDays || 0} (${result.attendancePercentage || 0}%)`, 
           50, yPos);
  
  if (result.remarks) {
    yPos += 30;
    doc.fontSize(12).font('Helvetica-Bold').text('REMARKS', 50, yPos);
    yPos += 20;
    doc.font('Helvetica').fontSize(11).text(result.remarks, 50, yPos, { width: 500 });
  }
  
  // Signatures
  yPos += 40;
  doc.moveTo(100, yPos).lineTo(250, yPos).stroke();
  doc.moveTo(350, yPos).lineTo(500, yPos).stroke();
  
  yPos += 5;
  doc.fontSize(10);
  doc.text('Class Teacher', 100, yPos, { width: 150, align: 'center' });
  doc.text('Principal', 350, yPos, { width: 150, align: 'center' });
  
  doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, 50, 750, { align: 'center', width: 500 });
  doc.text('This is a system generated result', { align: 'center' });
  
  doc.end();
});

export default {
  getSectionsForResult,
  getStudentsForResult,
  createResult,
  getResultById,
  updateResult,
  getResultsByTeacher,
  getApprovedResults,
  deleteResult,
  downloadResult
};