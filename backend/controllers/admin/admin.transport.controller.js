import mongoose from 'mongoose';
import Vehicle from '../../models/Vehicle.js';
import TransportStaff from '../../models/TransportStaff.js';
import FuelLog from '../../models/FuelLog.js';
import TripLog from '../../models/TripLog.js';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import Expense from '../../models/Expense.js';
import ExpenseCategory from '../../models/ExpenseCategory.js';

// ==============================================
// 1. VEHICLE MANAGEMENT
// ==============================================

export const addVehicle = asyncHandler(async (req, res) => {
  let { registrationNumber, capacity, type, make, model, year, status } = req.body;
  const schoolId = req.schoolId;

  // Normalize enums to match Schema (e.g., "bus" -> "Bus", "active" -> "Active")
  if (type) type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  if (status) status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  const existing = await Vehicle.findOne({ schoolId, registrationNumber });
  if (existing) {
    throw new ValidationError(`Vehicle with registration number ${registrationNumber} already exists.`);
  }

  const vehicle = await Vehicle.create({
    schoolId, registrationNumber, capacity, type, make, model, year, status
  });

  return successResponse(res, "Vehicle added successfully", vehicle, 201);
});

export const getVehicles = asyncHandler(async (req, res) => {
  const { status, type } = req.query;
  const filter = { schoolId: req.schoolId };

  if (status) filter.status = status;
  if (type) filter.type = type;

  const vehicles = await Vehicle.find(filter).sort({ createdAt: -1 });
  return successResponse(res, "Vehicles retrieved successfully", vehicles);
});

export const updateVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  if (updateData.type) updateData.type = updateData.type.charAt(0).toUpperCase() + updateData.type.slice(1).toLowerCase();
  if (updateData.status) updateData.status = updateData.status.charAt(0).toUpperCase() + updateData.status.slice(1).toLowerCase();

  const vehicle = await Vehicle.findOneAndUpdate(
    { _id: id, schoolId: req.schoolId },
    updateData,
    { new: true, runValidators: true }
  );

  if (!vehicle) throw new NotFoundError("Vehicle");
  return successResponse(res, "Vehicle updated successfully", vehicle);
});

export const deleteVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vehicle = await Vehicle.findOneAndDelete({ _id: id, schoolId: req.schoolId });
  
  if (!vehicle) throw new NotFoundError("Vehicle");
  
  // Unset assigned vehicle from staff so they aren't pointing to a deleted reference
  await TransportStaff.updateMany(
    { assignedVehicle: id, schoolId: req.schoolId }, 
    { $unset: { assignedVehicle: 1 } }
  );

  return successResponse(res, "Vehicle deleted successfully");
});

// ==============================================
// 2. TRANSPORT STAFF (DRIVER/HELPER) MANAGEMENT
// ==============================================

export const addTransportStaff = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  
  // Safely map common frontend mismatches
  if (payload.phoneNumber && !payload.phone) payload.phone = payload.phoneNumber;
  if (payload.staffType && !payload.type) payload.type = payload.staffType;

  // Normalize type enum ("driver" -> "Driver")
  if (payload.type) payload.type = payload.type.charAt(0).toUpperCase() + payload.type.slice(1).toLowerCase();

  const staff = await TransportStaff.create({ ...payload, schoolId: req.schoolId });
  return successResponse(res, "Transport staff added successfully", staff, 201);
});

export const getTransportStaff = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const filter = { schoolId: req.schoolId };
  if (type) filter.type = type;

  const staff = await TransportStaff.find(filter)
    .populate('assignedVehicle', 'registrationNumber type')
    .sort({ createdAt: -1 });
    
  return successResponse(res, "Transport staff retrieved successfully", staff);
});

export const updateTransportStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Safely map common frontend mismatches
  if (updateData.phoneNumber && !updateData.phone) updateData.phone = updateData.phoneNumber;
  if (updateData.staffType && !updateData.type) updateData.type = updateData.staffType;

  if (updateData.type) updateData.type = updateData.type.charAt(0).toUpperCase() + updateData.type.slice(1).toLowerCase();

  const staff = await TransportStaff.findOneAndUpdate(
    { _id: id, schoolId: req.schoolId },
    updateData,
    { new: true, runValidators: true }
  );

  if (!staff) throw new NotFoundError("Transport Staff");
  return successResponse(res, "Transport staff updated successfully", staff);
});

export const deleteTransportStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const staff = await TransportStaff.findOneAndDelete({ _id: id, schoolId: req.schoolId });
  
  if (!staff) throw new NotFoundError("Transport Staff");
  return successResponse(res, "Transport staff deleted successfully");
});

// ==============================================
// 3. FUEL MANAGEMENT (DIESEL IN)
// ==============================================

export const addFuelLog = asyncHandler(async (req, res) => {
  const log = await FuelLog.create({ 
    ...req.body, 
    schoolId: req.schoolId,
    loggedBy: req.user.id // Captures the admin who made the entry
  });

  // ✅ NEW: Sync with Expense Ledger
  let category = await ExpenseCategory.findOne({ schoolId: req.schoolId, name: 'Transport Fuel', isSystemGenerated: true });
  if (!category) {
    category = await ExpenseCategory.create({ schoolId: req.schoolId, name: 'Transport Fuel', description: 'System generated category for vehicle fuel', isSystemGenerated: true });
  }

  await Expense.create({
    schoolId: req.schoolId,
    category: category._id,
    amount: log.totalCost,
    date: log.date || new Date(),
    paymentMode: 'CASH', // default for fuel
    source: 'TRANSPORT_FUEL',
    referenceId: log._id,
    description: `Fuel log added for vehicle`
  });

  return successResponse(res, "Fuel log added successfully", log, 201);
});

export const getFuelLogs = asyncHandler(async (req, res) => {
  const { vehicleId, startDate, endDate } = req.query;
  const filter = { schoolId: req.schoolId };
  
  if (vehicleId) filter.vehicle = vehicleId;
  if (startDate && endDate) {
    filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const logs = await FuelLog.find(filter)
    .populate('vehicle', 'registrationNumber type')
    .populate('loggedBy', 'name email')
    .sort({ date: -1 })
    .lean(); // .lean() converts Mongoose documents to plain JS objects

  // Map alias fields for frontend compatibility
  const formattedLogs = logs.map(log => ({
    ...log,
    currentOdometer: log.odometerReading
  }));

  return successResponse(res, "Fuel logs retrieved successfully", formattedLogs);
});

// ✅ NEW: Required so the system cleans up the related expense when log is deleted
export const deleteFuelLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const log = await FuelLog.findOneAndDelete({ _id: id, schoolId: req.schoolId });
  if (!log) throw new NotFoundError("Fuel Log");

  // Sync with Expense Ledger: Remove the associated expense
  await Expense.findOneAndDelete({ schoolId: req.schoolId, source: 'TRANSPORT_FUEL', referenceId: id });

  return successResponse(res, "Fuel log and associated expense deleted successfully");
});

// ==============================================
// 4. TRIP LOGBOOK MANAGEMENT
// ==============================================

export const addTripLog = asyncHandler(async (req, res) => {
  const { startOdometer, endOdometer } = req.body;
  if (Number(endOdometer) < Number(startOdometer)) {
    throw new ValidationError('End odometer reading cannot be less than the start odometer reading.');
  }

  const trip = await TripLog.create({ ...req.body, schoolId: req.schoolId });
  return successResponse(res, "Trip logged successfully", trip, 201);
});

export const getTripLogs = asyncHandler(async (req, res) => {
  const { vehicleId, driverId, startDate, endDate } = req.query;
  const filter = { schoolId: req.schoolId };
  
  if (vehicleId) filter.vehicle = vehicleId;
  if (driverId) filter.driver = driverId;
  if (startDate && endDate) {
    filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const trips = await TripLog.find(filter)
    .populate('vehicle', 'registrationNumber type')
    .populate('driver', 'name phone')
    .sort({ date: -1 })
    .lean();

  // Calculate distance and map alias fields for frontend compatibility
  const formattedTrips = trips.map(trip => ({
    ...trip,
    distance: (trip.endOdometer || 0) - (trip.startOdometer || 0),
    routeInfo: trip.routeDescription
  }));

  return successResponse(res, "Trip logs retrieved successfully", formattedTrips);
});

// ==============================================
// 5. REPORTING ENGINE
// ==============================================

export const getTransportReport = asyncHandler(async (req, res) => {
  const { month, year } = req.query; 
  // Mongoose aggregate() requires strict ObjectId casting, it does not auto-cast like find()
  const schoolId = new mongoose.Types.ObjectId(req.schoolId);

  let dateFilter = {};
  if (month && year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    dateFilter = { date: { $gte: startDate, $lte: endDate } };
  }

  // Aggregate fuel logs
  const fuelStats = await FuelLog.aggregate([
    { $match: { schoolId, ...dateFilter } },
    { $group: {
        _id: "$vehicle",
        totalFuelLiters: { $sum: "$quantityLiters" },
        totalFuelCost: { $sum: "$totalCost" }
      }
    }
  ]);

  // Aggregate trip logs (Distance = endOdometer - startOdometer)
  const tripStats = await TripLog.aggregate([
    { $match: { schoolId, ...dateFilter } },
    { $group: {
        _id: "$vehicle",
        totalDistance: { $sum: { $subtract: ["$endOdometer", "$startOdometer"] } },
        totalTrips: { $sum: 1 }
      }
    }
  ]);

  // Combine stats with vehicle details
  const vehicles = await Vehicle.find({ schoolId: req.schoolId }).select('registrationNumber type status');

  const report = vehicles.map(v => {
    const fStat = fuelStats.find(f => f._id.toString() === v._id.toString()) || { totalFuelLiters: 0, totalFuelCost: 0 };
    const tStat = tripStats.find(t => t._id.toString() === v._id.toString()) || { totalDistance: 0, totalTrips: 0 };
    
    // Efficiency calculation (Km per liter)
    const mileage = fStat.totalFuelLiters > 0 ? (tStat.totalDistance / fStat.totalFuelLiters).toFixed(2) : 0;

    return {
      vehicleId: v._id,
      registrationNumber: v.registrationNumber,
      type: v.type,
      status: v.status,
      totalTrips: tStat.totalTrips,
      totalDistanceKm: tStat.totalDistance,
      totalFuelLiters: fStat.totalFuelLiters,
      totalFuelCost: fStat.totalFuelCost,
      efficiencyKmPerLiter: Number(mileage)
    };
  });

  return successResponse(res, "Transport report generated successfully", report);
});