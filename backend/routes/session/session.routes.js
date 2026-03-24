import express from "express";
import {
  getAllSessions,
  getActiveSession,
  createSession,
  updateSession,
} from "../../controllers/session/session.controller.js";

const router = express.Router();

router.get("/all", getAllSessions);
router.get("/active", getActiveSession);
router.post("/create", createSession);
router.put("/:id", updateSession);

export default router;