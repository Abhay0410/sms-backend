import bcrypt from "bcryptjs";

import Parent from "../../models/Parent.js";
import Enrollment from "../../models/Enrollment.js";

import { asyncHandler } from "../../middleware/errorHandler.js";

import { successResponse } from "../../utils/response.js";

import {
  NotFoundError,
} from "../../utils/errors.js";

import { deleteFromCloudinary } from "../../utils/cloudinary.js";

/* ------------------------------------------------ */
/* SAFE PARENT */
/* ------------------------------------------------ */

const safeParent = (parent) => {
  if (!parent) return null;

  const obj = parent.toObject
    ? parent.toObject()
    : parent;

  delete obj.password;

  return obj;
};

/* ------------------------------------------------ */
/* GET ALL PARENTS */
/* ------------------------------------------------ */

export const getAllParentProfiles =
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search = "",
    } = req.query;

   const query = {};

    if (search.trim()) {
      query.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },

        {
          parentID: {
            $regex: search,
            $options: "i",
          },
        },

        {
          email: {
            $regex: search,
            $options: "i",
          },
        },

        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const [parents, total] =
      await Promise.all([
        Parent.find(query)
          .populate(
            "children",
            "name studentID profilePicture"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),

        Parent.countDocuments(query),
      ]);

    return successResponse(
      res,
      "Parents fetched successfully",
      {
        parents,

        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(
            total / Number(limit)
          ),
        },
      }
    );
  });

/* ------------------------------------------------ */
/* GET PARENT PROFILE BY ID */
/* ------------------------------------------------ */

export const getParentProfileById =
  asyncHandler(async (req, res) => {
    const { parentId } = req.params;

    console.log("REQ PARAMS:", req.params);
console.log("PARENT ID:", req.params.parentId);

    const parent = await Parent.findOne({
      _id: parentId,
      schoolId: req.schoolId,
    }).populate(
      "children",
      "name studentID status email phone profilePicture"
    );
    console.log("FOUND PARENT:", parent);
    console.log("REQ SCHOOL ID:", req.schoolId);

    if (!parent) {
      throw new NotFoundError(
        "Parent not found"
      );
    }

    return successResponse(
      res,
      "Parent profile fetched successfully",
      {
        parent: safeParent(parent),
      }
    );
  });

/* ------------------------------------------------ */
/* GET CHILDREN */
/* ------------------------------------------------ */

export const getChildren =
  asyncHandler(async (req, res) => {
    const { parentId } = req.params;

    const parent = await Parent.findOne({
      _id: parentId,
      schoolId: req.schoolId,
    }).populate(
      "children",
      "name studentID status email phone profilePicture"
    );

    if (!parent) {
      throw new NotFoundError(
        "Parent not found"
      );
    }

    const childrenIds = (
      parent.children || []
    ).map((child) => child._id);

    const enrollments =
      await Enrollment.find({
        student: { $in: childrenIds },
        schoolId: req.schoolId,
        status: "ACTIVE",
      }).lean();

    const enrollmentMap = new Map();

    enrollments.forEach((e) => {
      enrollmentMap.set(
        e.student.toString(),
        e
      );
    });

    const children = (
      parent.children || []
    ).map((child) => {
      const enrollment =
        enrollmentMap.get(
          child._id.toString()
        );

      const childObj = child.toObject();

      if (enrollment) {
        childObj.className =
          enrollment.className;

        childObj.section =
          enrollment.section;

        childObj.rollNumber =
          enrollment.rollNumber;

        childObj.academicYear =
          enrollment.academicYear;
      }

      return childObj;
    });

    return successResponse(
      res,
      "Children fetched successfully",
      {
        children,
      }
    );
  });

/* ------------------------------------------------ */
/* UPDATE PROFILE */
/* ------------------------------------------------ */

export const updateProfile =
  asyncHandler(async (req, res) => {
    const { parentId } = req.params;

    const parent = await Parent.findOne({
      _id: parentId,
      schoolId: req.schoolId,
    });

    if (!parent) {
      throw new NotFoundError(
        "Parent not found"
      );
    }

    const allowedFields = [
      "name",
      "phone",
      "occupation",
      "qualification",
      "email",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        parent[field] = req.body[field];
      }
    });

    if (req.body.address) {
      if (
        typeof req.body.address === "string"
      ) {
        parent.address = {
          street: req.body.address,
        };
      } else {
        parent.address = {
          ...parent.address,
          ...req.body.address,
        };
      }
    }

    if (req.file) {
      if (
        parent.profilePicturePublicId
      ) {
        await deleteFromCloudinary(
          parent.profilePicturePublicId
        );
      }

      parent.profilePicture =
        req.file.path;

      parent.profilePicturePublicId =
        req.file.filename;
    }

    await parent.save();

    return successResponse(
      res,
      "Parent updated successfully",
      {
        parent: safeParent(parent),
      }
    );
  });

/* ------------------------------------------------ */
/* CHANGE PASSWORD */
/* ------------------------------------------------ */

export const changePassword =
  asyncHandler(async (req, res) => {
    const { parentId } = req.params;

    const { newPassword } = req.body;

    if (!newPassword) {
      throw new Error(
        "New password is required"
      );
    }

    const parent = await Parent.findOne({
      _id: parentId,
      schoolId: req.schoolId,
    }).select("+password");

    if (!parent) {
      throw new NotFoundError(
        "Parent not found"
      );
    }

    parent.password =
      await bcrypt.hash(newPassword, 10);

    parent.requiresPasswordChange =
      false;

    await parent.save();

    return successResponse(
      res,
      "Password changed successfully"
    );
  });

export default {
  getAllParentProfiles,
  getParentProfileById,
  getChildren,
  updateProfile,
  changePassword,
};