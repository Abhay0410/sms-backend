import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  addVehicle,
  getVehicles,
  updateVehicle,
  deleteVehicle,
  addTransportStaff,
  getTransportStaff,
  updateTransportStaff,
  deleteTransportStaff,
  addFuelLog,
  getFuelLogs,
  addTripLog,
  getTripLogs,
  getTransportReport
} from "../../controllers/admin/admin.transport.controller.js";

const router = Router();

// Protect all transport routes - strictly Admin only
router.use(requireAuth(["admin"]));

// ==========================================
// 1. VEHICLES
// ==========================================
router.route("/vehicles")
  .post(addVehicle)
  .get(getVehicles);
router.route("/vehicles/:id")
  .put(updateVehicle)
  .delete(deleteVehicle);

// ==========================================
// 2. TRANSPORT STAFF (Drivers & Helpers)
// ==========================================
router.route("/staff")
  .post(addTransportStaff)
  .get(getTransportStaff);
router.route("/staff/:id")
  .put(updateTransportStaff)
  .delete(deleteTransportStaff);

// ==========================================
// 3. FUEL LOGS (Diesel In)
// ==========================================
router.route("/fuel")
  .post(addFuelLog)
  .get(getFuelLogs);

// ==========================================
// 4. TRIP LOGBOOK
// ==========================================
router.route("/trips")
  .post(addTripLog)
  .get(getTripLogs);

// ==========================================
// 5. REPORTS
// ==========================================
router.get("/report", getTransportReport);

export default router;