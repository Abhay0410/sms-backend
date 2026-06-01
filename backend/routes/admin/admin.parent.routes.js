// routes/admin/admin.parent.routes.js

import express from "express";

import {
  getAllParentProfiles,
  getParentProfileById,
  getChildren,
  updateProfile,
  changePassword,
} from "../../controllers/admin/admin.parent.controller.js";

import upload from "../../middleware/upload.js";

import {
  requireSchoolAdmin,
} from "../../middleware/auth.js";


const router = express.Router();

router.use(requireSchoolAdmin());

router.get("/", getAllParentProfiles);

router.get(
  "/:parentId",
  getParentProfileById
);

router.get(
  "/:parentId/children",
  getChildren
);

router.put(
  "/:parentId",
  upload.single("photo"),
  updateProfile
);

router.put(
  "/:parentId/change-password",
  changePassword
);

export default router;