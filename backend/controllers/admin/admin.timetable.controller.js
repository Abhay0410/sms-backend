// controllers/admin/admin.timetable.controller.js - MULTI-TENANT VERSION
import Timetable from '../../models/Timetable.js';
import Class from '../../models/Class.js';
import Teacher from '../../models/Teacher.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

// Create timetable - MULTI-TENANT
export const createTimetable = asyncHandler(async (req, res) => {
  const { classId, section, academicYear, schedule, effectiveFrom, effectiveTo, overwrite = false } = req.body;
  const adminId = req.user.id;
  
  if (!classId || !section || !academicYear) {
    throw new ValidationError('Class, section, and academic year are required');
  }
  
  const classData = await Class.findOne({
    _id: classId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!classData) {
    throw new NotFoundError('Class');
  }
  
  // Check if timetable already exists - MULTI-TENANT
  const existingTimetable = await Timetable.findOne({
    class: classId,
    section,
    academicYear,
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true
  });
  
  let timetable;
  
  console.log('📥 Incoming schedule:', {
    days: schedule?.map(s => ({ day: s.day, periods: s.periods?.length })),
    saturday: schedule?.find(s => s.day === 'Saturday')?.periods?.filter(p => p.isBreak)
  });
  
  if (existingTimetable) {
    if (overwrite) {
      console.log('🔄 Updating existing timetable:', existingTimetable._id);
      
      existingTimetable.schedule = schedule || [];
      existingTimetable.effectiveFrom = effectiveFrom || new Date();
      existingTimetable.effectiveTo = effectiveTo;
      existingTimetable.status = 'draft';
      existingTimetable.updatedAt = new Date();
      
      await existingTimetable.save();
      timetable = existingTimetable;
      
      console.log('✅ Existing timetable updated successfully');
    } else {
      throw new ValidationError('Active timetable already exists for this class and section. Use overwrite=true to replace it.');
    }
  } else {
    console.log('🆕 Creating new timetable');
    timetable = new Timetable({
      schoolId: req.schoolId,  // ✅ MULTI-TENANT
      class: classId,
      className: classData.className,
      section,
      academicYear,
      schedule: schedule || [],
      effectiveFrom: effectiveFrom || new Date(),
      effectiveTo,
      isActive: true,
      status: 'draft',
      createdBy: adminId
    });
    
    await timetable.save();
    console.log('✅ New timetable created successfully');
  }
  
  await timetable.populate('class', 'className');
  await timetable.populate('schedule.periods.teacher', 'name teacherID');
  
  console.log('💾 Saved timetable:', {
    id: timetable._id,
    days: timetable.schedule?.map(s => ({ day: s.day, periods: s.periods?.length })),
    saturdayLunch: timetable.schedule?.find(s => s.day === 'Saturday')?.periods?.filter(p => p.isBreak)
  });
  
  return successResponse(res, 'Timetable processed successfully', timetable, existingTimetable ? 200 : 201);
});

// Get all timetables - MULTI-TENANT
export const getAllTimetables = asyncHandler(async (req, res) => {
  const { academicYear, classId, section, isActive, status } = req.query;
  
  const filter = { schoolId: req.schoolId }; // ✅ MULTI-TENANT
  
  if (academicYear) filter.academicYear = academicYear;
  if (classId) filter.class = classId;
  if (section) filter.section = section;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (status) filter.status = status;
  
  const timetables = await Timetable.find(filter)
    .populate('class', 'className')
    .populate('createdBy', 'name adminID')
    .populate('publishedBy', 'name adminID')
    .populate('schedule.periods.teacher', 'name teacherID')
    .sort({ createdAt: -1 });
  
  return successResponse(res, 'Timetables retrieved successfully', timetables);
});

// Get timetable by ID - MULTI-TENANT
export const getTimetableById = asyncHandler(async (req, res) => {
  const { timetableId } = req.params;
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  })
    .populate('class', 'className sections')
    .populate('createdBy', 'name adminID')
    .populate('publishedBy', 'name adminID')
    .populate('schedule.periods.teacher', 'name teacherID');
  
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  return successResponse(res, 'Timetable retrieved successfully', timetable);
});

// Get timetable by class and section - MULTI-TENANT
export const getTimetableByClassSection = asyncHandler(async (req, res) => {
  const { classId, section } = req.query;
  const academicYear = req.query.academicYear || getCurrentAcademicYear();
  
  console.log('🔍 GET Timetable Request:', { classId, section, academicYear });
  
  if (!classId || !section) {
    throw new ValidationError('Class and section are required');
  }
  
  const timetable = await Timetable.findOne({
    class: classId,
    section,
    academicYear,
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true
  })
    .populate('class', 'className')
    .populate('schedule.periods.teacher', 'name teacherID')
    .sort({ createdAt: -1 });
  
  console.log('📦 Found timetable:', timetable ? timetable._id : 'None');
  
  if (!timetable) {
    console.log('❌ No timetable found');
    throw new NotFoundError('Timetable not found for this class and section');
  }
  
  return successResponse(res, 'Timetable retrieved successfully', timetable);
});

// Update timetable - MULTI-TENANT
export const updateTimetable = asyncHandler(async (req, res) => {
  const { timetableId } = req.params;
  const updateData = req.body;
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  if (timetable.status === 'published') {
    throw new ValidationError('Cannot edit published timetable. Please unpublish it first to make changes.');
  }
  
  const updatedTimetable = await Timetable.findOneAndUpdate(
    { _id: timetableId, schoolId: req.schoolId },
    updateData,
    { new: true, runValidators: true }
  )
    .populate('class', 'className')
    .populate('schedule.periods.teacher', 'name teacherID');
  
  return successResponse(res, 'Timetable updated successfully', updatedTimetable);
});

// Delete timetable - MULTI-TENANT
export const deleteTimetable = asyncHandler(async (req, res) => {
  const { timetableId } = req.params;
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  if (timetable.status === 'published') {
    throw new ValidationError('Cannot delete published timetable. Please unpublish it first.');
  }
  
  await Timetable.findOneAndDelete({ _id: timetableId, schoolId: req.schoolId });
  
  return successResponse(res, 'Timetable deleted successfully');
});

// Activate/Deactivate timetable - MULTI-TENANT
export const toggleTimetableStatus = asyncHandler(async (req, res) => {
  const { timetableId } = req.params;
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  timetable.isActive = !timetable.isActive;
  await timetable.save();
  
  return successResponse(res, `Timetable ${timetable.isActive ? 'activated' : 'deactivated'} successfully`, timetable);
});

// Publish timetable - MULTI-TENANT
export const publishTimetable = asyncHandler(async (req, res) => {
  const { timetableId } = req.params;
  const adminId = req.user.id;
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  }).populate('schedule.periods.teacher', 'name teacherID');
  
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  if (timetable.status === 'published') {
    throw new ValidationError('Timetable is already published');
  }
  
  if (!timetable.schedule || timetable.schedule.length === 0) {
    throw new ValidationError('Cannot publish empty timetable. Please add at least one day with periods.');
  }
  
  timetable.status = 'published';
  timetable.publishedAt = new Date();
  timetable.publishedBy = adminId;
  await timetable.save();
  
  return successResponse(res, 'Timetable published successfully', timetable);
});

// Unpublish timetable - MULTI-TENANT
export const unpublishTimetable = asyncHandler(async (req, res) => {
  const { timetableId } = req.params;
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  if (timetable.status === 'draft') {
    throw new ValidationError('Timetable is already in draft status');
  }
  
  timetable.status = 'draft';
  await timetable.save();
  
  return successResponse(res, 'Timetable moved to draft. You can now edit it.', timetable);
});

// Add day to timetable - MULTI-TENANT
export const addDay = asyncHandler(async (req, res) => {
  const { timetableId } = req.params;
  const { day, periods } = req.body;
  
  if (!day) {
    throw new ValidationError('Day is required');
  }
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  if (timetable.status === 'published') {
    throw new ValidationError('Cannot modify published timetable. Please unpublish it first.');
  }
  
  const dayExists = timetable.schedule.some(d => d.day === day);
  if (dayExists) {
    throw new ValidationError(`${day} already exists in timetable`);
  }
  
  timetable.schedule.push({
    day,
    periods: periods || []
  });
  
  await timetable.save();
  
  return successResponse(res, 'Day added to timetable successfully', timetable);
});

// Create/Add period to a specific day - MULTI-TENANT
export const createPeriod = asyncHandler(async (req, res) => {
  const { timetableId, day } = req.params;
  const { subject, teacher, startTime, endTime, periodNumber, room } = req.body;
  
  if (!subject || !startTime || !endTime) {
    throw new ValidationError('Subject, start time, and end time are required');
  }
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  if (timetable.status === 'published') {
    throw new ValidationError('Cannot modify published timetable. Please unpublish it first.');
  }
  
  let daySchedule = timetable.schedule.find(d => d.day === day);
  
  if (!daySchedule) {
    timetable.schedule.push({
      day,
      periods: []
    });
    daySchedule = timetable.schedule[timetable.schedule.length - 1];
  }
  
  if (teacher) {
    const teacherExists = await Teacher.findOne({
      _id: teacher,
      schoolId: req.schoolId  // ✅ MULTI-TENANT
    });
    if (!teacherExists) {
      throw new NotFoundError('Teacher');
    }
    
    const conflictingTimetables = await Timetable.find({
      _id: { $ne: timetableId },
      academicYear: timetable.academicYear,
      schoolId: req.schoolId,  // ✅ MULTI-TENANT
      isActive: true,
      status: 'published',
      'schedule.day': day,
      'schedule.periods.teacher': teacher,
      'schedule.periods.isBreak': false
    }).populate('class', 'className');
    
    for (const tt of conflictingTimetables) {
      const ttDaySchedule = tt.schedule.find(d => d.day === day);
      if (ttDaySchedule) {
        for (const period of ttDaySchedule.periods) {
          if (period.teacher && period.teacher.toString() === teacher && !period.isBreak) {
            const existingStart = period.startTime;
            const existingEnd = period.endTime;
            
            if (isTimeOverlap(startTime, endTime, existingStart, existingEnd)) {
              throw new ValidationError(
                `Teacher ${teacherExists.name} is already assigned to ${tt.className} ${tt.section} during this time (${existingStart} - ${existingEnd})`
              );
            }
          }
        }
      }
    }
  }
  
  const newPeriod = {
    periodNumber: periodNumber || (daySchedule.periods.length + 1),
    subject,
    teacher: teacher || null,
    startTime,
    endTime,
    room: room || '',
    isBreak: false
  };
  
  daySchedule.periods.push(newPeriod);
  daySchedule.periods.sort((a, b) => a.periodNumber - b.periodNumber);
  
  await timetable.save();
  await timetable.populate('schedule.periods.teacher', 'name teacherID');
  
  return successResponse(res, 'Period added successfully', timetable, 201);
});

// Add break - MULTI-TENANT
export const addBreak = asyncHandler(async (req, res) => {
  const { timetableId, day } = req.params;
  const { startTime, endTime, periodNumber, breakType } = req.body;
  
  if (!startTime || !endTime) {
    throw new ValidationError('Start time and end time are required');
  }
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  if (timetable.status === 'published') {
    throw new ValidationError('Cannot modify published timetable. Please unpublish it first.');
  }
  
  let daySchedule = timetable.schedule.find(d => d.day === day);
  
  if (!daySchedule) {
    timetable.schedule.push({
      day,
      periods: []
    });
    daySchedule = timetable.schedule[timetable.schedule.length - 1];
  }
  
  daySchedule.periods.push({
    periodNumber: periodNumber || (daySchedule.periods.length + 1),
    subject: breakType || 'Lunch Break',
    teacher: null,
    startTime,
    endTime,
    room: '',
    isBreak: true,
    breakType: breakType || 'Lunch Break'
  });
  
  daySchedule.periods.sort((a, b) => a.periodNumber - b.periodNumber);
  
  await timetable.save();
  
  return successResponse(res, 'Break added successfully', timetable);
});

// Update period - MULTI-TENANT
export const updatePeriod = asyncHandler(async (req, res) => {
  const { timetableId, day, periodId } = req.params;
  const updates = req.body;
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  if (timetable.status === 'published') {
    throw new ValidationError('Cannot modify published timetable. Please unpublish it first.');
  }
  
  const daySchedule = timetable.schedule.find(d => d.day === day);
  if (!daySchedule) {
    throw new NotFoundError('Day not found in timetable');
  }
  
  const period = daySchedule.periods.id(periodId);
  if (!period) {
    throw new NotFoundError('Period');
  }
  
  if (updates.subject !== undefined) period.subject = updates.subject;
  if (updates.teacher !== undefined) period.teacher = updates.teacher;
  if (updates.startTime !== undefined) period.startTime = updates.startTime;
  if (updates.endTime !== undefined) period.endTime = updates.endTime;
  if (updates.room !== undefined) period.room = updates.room;
  if (updates.periodNumber !== undefined) period.periodNumber = updates.periodNumber;
  
  await timetable.save();
  
  return successResponse(res, 'Period updated successfully', timetable);
});

// Delete period - MULTI-TENANT
export const deletePeriod = asyncHandler(async (req, res) => {
  const { timetableId, day, periodId } = req.params;
  
  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!timetable) {
    throw new NotFoundError('Timetable');
  }
  
  if (timetable.status === 'published') {
    throw new ValidationError('Cannot modify published timetable. Please unpublish it first.');
  }
  
  const daySchedule = timetable.schedule.find(d => d.day === day);
  if (!daySchedule) {
    throw new NotFoundError('Day not found in timetable');
  }
  
  const periodIndex = daySchedule.periods.findIndex(p => p._id.toString() === periodId);
  if (periodIndex === -1) {
    throw new NotFoundError('Period');
  }
  
  daySchedule.periods.splice(periodIndex, 1);
  await timetable.save();
  
  return successResponse(res, 'Period deleted successfully', timetable);
});

// Copy timetable to another section - MULTI-TENANT
export const copyTimetable = asyncHandler(async (req, res) => {
  const { sourceTimetableId, targetClassId, targetSection } = req.body;
  const adminId = req.user.id;
  
  if (!sourceTimetableId || !targetClassId || !targetSection) {
    throw new ValidationError('Source timetable, target class, and target section are required');
  }
  
  const sourceTimetable = await Timetable.findOne({
    _id: sourceTimetableId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!sourceTimetable) {
    throw new NotFoundError('Source timetable');
  }
  
  const targetClass = await Class.findOne({
    _id: targetClassId,
    schoolId: req.schoolId  // ✅ MULTI-TENANT
  });
  if (!targetClass) {
    throw new NotFoundError('Target class');
  }
  
  const existingTimetable = await Timetable.findOne({
    class: targetClassId,
    section: targetSection,
    academicYear: sourceTimetable.academicYear,
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    isActive: true
  });
  
  if (existingTimetable) {
    throw new ValidationError('Timetable already exists for target class and section');
  }
  
  const scheduleClone = JSON.parse(JSON.stringify(sourceTimetable.schedule));
  
  const newTimetable = new Timetable({
    schoolId: req.schoolId,  // ✅ MULTI-TENANT
    class: targetClassId,
    className: targetClass.className,
    section: targetSection,
    academicYear: sourceTimetable.academicYear,
    schedule: scheduleClone,
    effectiveFrom: sourceTimetable.effectiveFrom,
    effectiveTo: sourceTimetable.effectiveTo,
    isActive: true,
    status: 'draft',
    createdBy: adminId
  });
  
  await newTimetable.save();
  
  return successResponse(res, 'Timetable copied successfully', newTimetable, 201);
});

function isTimeOverlap(start1, end1, start2, end2) {
  return (start1 < end2 && end1 > start2);
}

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export default {
  createTimetable,
  getAllTimetables,
  getTimetableById,
  getTimetableByClassSection,
  updateTimetable,
  deleteTimetable,
  toggleTimetableStatus,
  publishTimetable,
  unpublishTimetable,
  addDay,
  createPeriod,
  addBreak,
  updatePeriod,
  deletePeriod,
  copyTimetable,
};
