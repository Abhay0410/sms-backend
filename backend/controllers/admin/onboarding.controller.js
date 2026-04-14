import fs from 'fs';
import csv from 'csv-parser';
import bcrypt from 'bcryptjs';
import Student from '../../models/Student.js';
import Parent from '../../models/Parent.js';
import Class from '../../models/Class.js';
import Teacher from '../../models/Teacher.js';
import FeeHead from '../../models/FeeHead.js';
import FeePayment from '../../models/FeePayment.js';
import { generateInstallments } from '../../utils/fee.utils.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { successResponse } from '../../utils/response.js';
import { ValidationError } from '../../utils/errors.js';

// Helper function to handle Case-Insensitive Headers
const getVal = (row, keyName) => {
  if (!row || typeof row !== 'object') return "";
  const keys = Object.keys(row);
  const foundKey = keys.find(k => k.trim().toLowerCase() === keyName.toLowerCase());
  return foundKey && row[foundKey] ? row[foundKey].trim() : "";
};

// ✅ NEW HELPER: Robust Class Finder
async function findClassRobust(schoolId, className, academicYear) {
  if (!className) return null;
  
  // 1. Exact string match (e.g., "Class 10")
  let cls = await Class.findOne({ schoolId, className, academicYear });
  if (cls) return cls;

  // 2. Try with "Class " prefix if missing (e.g. CSV has "10", DB has "Class 10")
  if (!className.toLowerCase().startsWith('class')) {
    cls = await Class.findOne({ schoolId, className: `Class ${className}`, academicYear });
    if (cls) return cls;
  }

  // 3. Try numeric match (e.g. CSV has "Ten" or "10", DB has classNumeric 10)
  const num = parseInt(className.replace(/\D/g, ''));
  if (!isNaN(num)) {
    cls = await Class.findOne({ schoolId, classNumeric: num, academicYear });
    if (cls) return cls;
  }

  return null;
}

// ============================================================
// 1. IMPORT ACADEMICS (Robust Version)
// ============================================================
export const importAcademics = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const { academicYear } = req.body;
  const filePath = req.file.path;
  const rows = [];

  if (!academicYear) throw new ValidationError("Academic Year is required");

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
          const classNumeric = parseInt(getVal(row, 'ClassNumeric')) || parseInt(className.replace(/\D/g, '')) || 0;

          if (!className || !sectionName) continue;

          const subjectsArray = rawSubjects ? rawSubjects.split(',').filter(s => s.trim()).map(s => ({
            subjectName: s.trim(),
            schoolId
          })) : [];

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
            errorDetails.push(`Row missing ID, Email or Name: ${JSON.stringify(row)}`);
            continue;
          }

          // Check for existing (Scoped to School)
          const existing = await Teacher.findOne({ 
            schoolId, 
            $or: [{ teacherID }, { email }] 
          });
          if (existing) { 
            skippedCount++; 
            // errorDetails.push(`${name}: Skipped (Duplicate ID or Email)`); // Optional: Uncomment to see why skipped
            continue; 
          }

          try {
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

  if (!academicYear) throw new ValidationError("Academic Year is required");
  
  // ID Generation logic
  const year = new Date().getFullYear().toString().slice(-2);
  const lastStudent = await Student.findOne({ schoolId }).sort({ studentID: -1 });
  let studentCounter = (lastStudent && lastStudent.studentID) ? parseInt(lastStudent.studentID.slice(-4)) + 1 : 1;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => rows.push(data))
    .on('end', async () => {
      try {
        const results = { success: 0, skipped: 0, errors: [] };
        const pass = await bcrypt.hash("Student@123", 10);

        for (const row of rows) {
          try {
            // 🧹 CLEANING LOGIC: Aapke CSV mein names break ho rahe hain, unhe clean karo
            const rawName = getVal(row, 'Name').replace(/\r?\n|\r/g, " ").trim();
            const rawParentName = getVal(row, 'ParentName').replace(/\r?\n|\r/g, " ").trim();
            const csvAdmissionID = getVal(row, 'AdmissionID').trim();
            const className = getVal(row, 'ClassName').trim();
            const email = getVal(row, 'Email').trim().toLowerCase();

            if (!className || !rawName) continue;

            // 1. Robust Class Lookup
            const targetClass = await findClassRobust(schoolId, className, academicYear);
            if (!targetClass) {
              results.errors.push(`${rawName}: Class '${className}' not found`);
              continue;
            }

            // 2. Strict Duplicate Check (Only within THIS school)
            const existing = await Student.findOne({ 
              schoolId, 
              $or: [
                { admissionNumber: csvAdmissionID },
                ...(email ? [{ email }] : [])
              ]
            });

            if (existing) { 
              results.skipped++; 
              continue; 
            }

            // 3. Parent Handling (Unique PAR ID)
            const parentPhone = getVal(row, 'ParentPhone');
            const providedParentID = getVal(row, 'ParentID');
            
            let parent = await Parent.findOne({ 
              schoolId, 
              $or: [{ phone: parentPhone }, { parentID: providedParentID }] 
            });

            if (!parent) {
              parent = await Parent.create({
                schoolId,
                name: rawParentName,
                phone: parentPhone,
                email: getVal(row, 'ParentEmail') || `p_${csvAdmissionID}@school.com`,
                password: pass,
                parentID: providedParentID || `PAR${year}${results.success.toString().padStart(4, '0')}`,
                relation: 'Guardian',
                role: 'parent',
                isActive: true,
              });
            }

            // 4. Create Student
            const studentID = csvAdmissionID || `STU${year}${studentCounter.toString().padStart(4, '0')}`;
            const newStudent = await Student.create({
              schoolId,
              name: rawName,
              studentID: studentID,
              admissionNumber: csvAdmissionID,
              email: email || undefined, // ✅ Fix: Allow empty emails (don't force dummy)
              password: pass,
              class: targetClass._id,
              className: targetClass.className,
              section: getVal(row, 'Section'),
              rollNumber: parseInt(getVal(row, 'RollNumber')) || 0,
              academicYear,
              parent: parent._id,
              gender: getVal(row, 'Gender') || 'Male',
              fatherName: rawParentName,
              status: 'ENROLLED'
            });

            // Update Parent's children array
            await Parent.findByIdAndUpdate(parent._id, { $addToSet: { children: newStudent._id } });
            
            studentCounter++;
            results.success++;
          } catch (rowErr) {
            results.errors.push(`Error for ${getVal(row, 'Name')}: ${rowErr.message}`);
          }
        }
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return successResponse(res, `Process Complete. Imported: ${results.success}, Skipped: ${results.skipped}`, results);
      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: err.message });
      }
    });
});

// ============================================================
// 4. IMPORT FEE STRUCTURES (Improved with Detailed Logging)
// ============================================================
export const importFeeStructures = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const { academicYear } = req.body;
  const filePath = req.file.path;
  const rows = [];

  console.log(`🚀 Starting Fee Import for Year: ${academicYear}`);

  if (!academicYear) throw new ValidationError("Academic Year is required");

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => rows.push(data))
    .on('end', async () => {
      try {
        const results = { updatedClasses: 0, studentsSynced: 0, errors: [] };
        const classGrouped = {};

        // 1. Data Cleaning & Grouping
        rows.forEach(row => {
          let className = getVal(row, 'ClassName').replace(/\r?\n|\r/g, " ").trim();
          if (!className || className.toLowerCase() === 'fee' || className.toLowerCase() === 'classname') return;
          
          if (!classGrouped[className]) classGrouped[className] = [];
          classGrouped[className].push(row);
        });

        const classesInCSV = Object.keys(classGrouped);
        console.log("📂 Classes found in CSV:", classesInCSV);

        for (const className of classesInCSV) {
          try {
            // 2. Class find karo (Robust search)
            const targetClass = await findClassRobust(schoolId, className, academicYear);
            
            if (!targetClass) {
              const msg = `❌ Class '${className}' not found for session ${academicYear}. Ensure class is imported first.`;
              console.log(msg);
              results.errors.push(msg);
              continue;
            }

            const newFeeStructure = [];
            for (const row of classGrouped[className]) {
              // 3. 🧹 Clean FeeHead Name & Auto-Create if missing
              const rawHeadName = getVal(row, 'FeeHead').replace(/\r?\n|\r/g, " ").trim();
              if(!rawHeadName) continue;

              let head = await FeeHead.findOne({ schoolId, name: new RegExp(`^${rawHeadName}$`, 'i') });
              
              if (!head) {
                console.log(`✨ Auto-creating missing Fee Head: ${rawHeadName}`);
                head = await FeeHead.create({
                  schoolId,
                  name: rawHeadName,
                  type: 'RECURRING',
                  isActive: true
                });
              }

              let rawFreq = getVal(row, 'Frequency').toUpperCase().trim() || 'MONTHLY';
              if (rawFreq === 'ANNUALLY') rawFreq = 'YEARLY'; // 👈 Auto-fix mapping

              newFeeStructure.push({
                head: head._id,
                headName: head.name,
                amount: Number(getVal(row, 'Amount')) || 0,
                frequency: rawFreq,
                dueDateDay: Number(getVal(row, 'DueDateDay')) || 10
              });
            }

            if (newFeeStructure.length > 0) {
              // 4. Calculate Annual Total
              const totalAnnualFee = newFeeStructure.reduce((sum, fee) => {
                let multiplier = 1;
                if (fee.frequency === 'MONTHLY') multiplier = 12;
                else if (fee.frequency === 'QUARTERLY') multiplier = 4;
                return sum + (fee.amount * multiplier);
              }, 0);

              // 5. Update Class
              targetClass.feeStructure = newFeeStructure;
              targetClass.feeSettings = { ...targetClass.feeSettings, totalAnnualFee };
              await targetClass.save();
              results.updatedClasses++;

              // 6. Sync Students of this class
              const students = await Student.find({ class: targetClass._id, academicYear, schoolId });
              if (students.length > 0) {
                const bulkOps = students.map(student => {
                  const installments = generateInstallments(newFeeStructure, academicYear);
                  const total = installments.reduce((s, i) => s + i.amount, 0);
                  return {
                    updateOne: {
                      filter: { student: student._id, academicYear, schoolId },
                      update: { $set: { 
                        class: student.class, installments, totalDue: total, 
                        balancePending: total, status: 'PENDING',
                        className: targetClass.className, section: student.section,
                        studentName: student.name, studentID: student.studentID
                      }},
                      upsert: true
                    }
                  };
                });
                await FeePayment.bulkWrite(bulkOps);
                results.studentsSynced += students.length;
              }
              console.log(`✅ Fully Synced: ${className} (${students.length} students)`);
            }
          } catch (err) {
            results.errors.push(`${className}: ${err.message}`);
            console.error(`🔥 Error in ${className}:`, err);
          }
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return successResponse(res, "Import Task Completed", results);
      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: err.message });
      }
    });
});

// ============================================================
// 5. IMPORT FEE PAYMENTS (Migration Logic)
// ============================================================
export const importFeePayments = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const { academicYear } = req.body;
  const filePath = req.file.path;
  const rows = [];

  if (!academicYear) throw new ValidationError("Academic Year is required");

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => rows.push(data))
    .on('end', async () => {
      try {
        const results = { success: 0, failed: 0, errors: [] };

        for (const row of rows) {
          try {
            const studentID = getVal(row, 'StudentID').replace(/\r?\n|\r/g, "").trim();
            const amountPaid = Number(getVal(row, 'Amount')) || 0;
            const paymentMode = getVal(row, 'Mode').replace(/\r?\n|\r/g, "").toUpperCase().trim() || 'CASH';
            const rawDate = getVal(row, 'Date').trim();
            const paymentDate = rawDate ? new Date(rawDate) : new Date();
            const remarks = getVal(row, 'Remarks').replace(/\r?\n|\r/g, " ").trim() || "Migration";

            if (!studentID || amountPaid <= 0) continue;

            // 🔍 LOG 2: Searching for document
            const fee = await FeePayment.findOne({ studentID, academicYear, schoolId });

            if (!fee) {
              const errorMsg = `❌ [${studentID}] NOT FOUND in session ${academicYear}`;
              console.log(errorMsg);
              results.errors.push(errorMsg);
              results.failed++;
              continue;
            }

            // ⚙️ LOG 3: Document Found, starting allocation
            console.log(`🔎 Found Roadmap for ${studentID} (ObjID: ${fee._id})`);

            let remaining = amountPaid;
            const covered = [];
            fee.installments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

            for (let inst of fee.installments) {
              if (remaining <= 0) break;
              if (inst.status === "PAID") continue;

              const needed = inst.amount - (inst.paidAmount || 0);
              const allocated = Math.min(remaining, needed);

              inst.paidAmount = (inst.paidAmount || 0) + allocated;
              inst.status = inst.paidAmount >= inst.amount ? "PAID" : "PARTIAL";
              remaining -= allocated;
              covered.push({ installmentId: inst._id, amount: allocated, name: inst.name });
            }

            // 📝 PUSH PAYMENT
            fee.payments.push({
              amount: amountPaid,
              paymentMode,
              paymentDate: row.Date ? new Date(row.Date) : new Date(),
              receiptNumber: `MIG-${Date.now()}-${results.success}`,
              remarks,
              installmentsCovered: covered
            });

            fee.totalPaid = (fee.totalPaid || 0) + amountPaid;
            fee.balancePending = Math.max(0, fee.totalDue - fee.totalPaid);
            fee.status = fee.balancePending <= 0 ? "PAID" : "PARTIAL";

            await fee.save();
            results.success++;

          } catch (rowErr) {
            results.errors.push(`Row Error: ${rowErr.message}`);
            results.failed++;
          }
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return successResponse(res, "Import Task Finished", results);

      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: err.message });
      }
    });
});