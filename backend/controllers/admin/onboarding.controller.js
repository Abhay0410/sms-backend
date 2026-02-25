import fs from 'fs';
import csv from 'csv-parser';
import bcrypt from 'bcryptjs';
import Student from '../../models/Student.js';
import Parent from '../../models/Parent.js';
import Class from '../../models/Class.js';
import Teacher from '../../models/Teacher.js';
import FeePayment from '../../models/FeePayment.js';
import { generateInstallments } from '../../utils/fee.utils.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { successResponse } from '../../utils/response.js';

// Helper function to handle Case-Insensitive Headers
const getVal = (row, keyName) => {
  const keys = Object.keys(row);
  const foundKey = keys.find(k => k.trim().toLowerCase() === keyName.toLowerCase());
  return foundKey ? row[foundKey].trim() : "";
};

// ============================================================
// 1. IMPORT ACADEMICS (Robust Version)
// ============================================================
export const importAcademics = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const { academicYear } = req.body;
  const filePath = req.file.path;
  const rows = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => rows.push(data))
    .on('end', async () => {
      try {
        const results = { created: 0, updated: 0 };
        for (const row of rows) {
          const className = getVal(row, 'ClassName');
          const sectionName = getVal(row, 'SectionName');
          const rawSubjects = getVal(row, 'Subjects');
          const classNumeric = parseInt(getVal(row, 'ClassNumeric')) || 0;

          if (!className || !sectionName) continue;

          const subjectsArray = rawSubjects.split(',').filter(s => s.trim()).map(s => ({
            subjectName: s.trim(),
            schoolId
          }));

          const existingClass = await Class.findOne({ schoolId, className, academicYear });

          if (existingClass) {
            const sectionExists = existingClass.sections.find(s => s.sectionName === sectionName);
            if (!sectionExists) {
              existingClass.sections.push({ sectionName, subjects: subjectsArray, capacity: 40 });
              await existingClass.save();
              results.updated++;
            }
          } else {
            await Class.create({
              schoolId, className, classNumeric, academicYear,
              sections: [{ sectionName, subjects: subjectsArray, capacity: 40 }],
              isActive: true
            });
            results.created++;
          }
        }
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return successResponse(res, "Academics Processed", results);
      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: err.message });
      }
    });
});

// ============================================================
// 2. IMPORT TEACHERS (Updated with Debug Log)
// ============================================================
export const importTeachers = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const filePath = req.file.path;
  const rows = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => rows.push(data))
    .on('end', async () => {
      try {
        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errorDetails = [];
        
        const defaultPassword = await bcrypt.hash("Teacher@123", 10);

        for (const row of rows) {
          const teacherID = getVal(row, 'TeacherID');
          const email = getVal(row, 'Email').toLowerCase();
          const name = getVal(row, 'Name');

          if (!teacherID || !email || !name) {
            errorCount++;
            continue;
          }

          // Check for existing
          const existing = await Teacher.findOne({ $or: [{ teacherID }, { email }] });
          if (existing) { 
            skippedCount++; 
            continue; 
          }

          try {
            // 🔥 Yahan main saari possible fields bhej raha hoon default values ke saath
            await Teacher.create({
              schoolId,
              name,
              teacherID,
              email,
              phone: getVal(row, 'Phone') || "0000000000",
              password: defaultPassword,
              gender: getVal(row, 'Gender') || "Male", 
              designation: getVal(row, 'Designation') || "Teacher",
              department: getVal(row, 'Department') || "Academic",
              joiningDate: new Date(),
              isActive: true,
              role: "teacher"
            });
            successCount++;
          } catch (createErr) {
            errorCount++;
            // 🚨 YE LINE TERMINAL MEIN DEKHO: Pata chalega asli error kya hai
            console.log(`❌ Error creating ${name}:`, createErr.message); 
            errorDetails.push(`${name}: ${createErr.message}`);
          }
        }
        
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        const finalMsg = `Imported: ${successCount} | Skipped: ${skippedCount} | Failed: ${errorCount}`;
        
        return res.status(200).json({
          success: true,
          message: finalMsg,
          errors: errorDetails 
        });

      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: err.message });
      }
    });
});

// ============================================================
// 3. IMPORT STUDENTS (Sync with Fixed Logic)
// ============================================================
export const importStudents = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const { academicYear } = req.body;
  const filePath = req.file.path;
  const rows = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => rows.push(data))
    .on('end', async () => {
      try {
        const results = { success: 0, skipped: 0, errors: [] };
        const pass = await bcrypt.hash("Student@123", 10);

        for (const row of rows) {
          try {
            const studentID = getVal(row, 'AdmissionID');
            const className = getVal(row, 'ClassName');
            const section = getVal(row, 'Section');
            const parentPhone = getVal(row, 'ParentPhone');
            const parentName = getVal(row, 'ParentName');

            if (!studentID || !className || !parentName) {
              results.errors.push(`Row missing ID, Class or Parent Name`);
              continue;
            }

            // 1. Validate Target Class
            const targetClass = await Class.findOne({ schoolId, className, academicYear });
            if (!targetClass) {
              results.errors.push(`${studentID}: Class ${className} not found`);
              continue;
            }

            // 2. Global Duplicate Check
            const existing = await Student.findOne({ studentID, schoolId });
            if (existing) { results.skipped++; continue; }

            // 3. Create Parent
            let parent = await Parent.findOne({ phone: parentPhone, schoolId });
            if (!parent) {
              parent = await Parent.create({
                schoolId,
                name: parentName,
                phone: parentPhone,
                email: `p_${studentID}@school.com`,
                password: pass,
                parentID: `PAR${studentID}`, // ✅ Required Field
                relation: 'Guardian',        // ✅ Required Field
                role: 'parent',
                isActive: true
              });
            }

            // 4. Create Student
            const newStudent = await Student.create({
              schoolId,
              name: getVal(row, 'Name'),
              studentID,
              email: getVal(row, 'Email') || `${studentID}@school.com`,
              password: pass,
              class: targetClass._id,
              className,
              section,
              academicYear,
              parent: parent._id, // ✅ Fixed: parentId -> parent
              gender: getVal(row, 'Gender'),
              fatherName: parentName,
              role: 'student',
              isActive: true,
              status: 'ENROLLED'
            });

            // 5. Fee Initialization
            if (targetClass.feeStructure?.length > 0) {
              const installments = generateInstallments(targetClass.feeStructure, academicYear);
              const totalDue = installments.reduce((sum, i) => sum + i.amount, 0);
              await FeePayment.create({
                schoolId, student: newStudent._id, studentName: newStudent.name,
                studentID, className, section, academicYear,
                installments, totalDue, totalAmount: totalDue, balancePending: totalDue,
                status: 'PENDING'
              });
            }
            results.success++;
          } catch (rowErr) {
            console.error(`Row Error (${getVal(row, 'AdmissionID')}):`, rowErr.message);
            results.errors.push(`${getVal(row, 'AdmissionID')}: ${rowErr.message}`);
          }
        }
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        const msg = `Imported: ${results.success}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`;
        return res.status(200).json({
          success: true,
          message: msg,
          data: results
        });
      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: err.message });
      }
    });
});