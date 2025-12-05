/**
 * User routes.
 *
 * This router exposes endpoints related to user management.
 * For now it only contains:
 *   POST /api/users  -> createUser
 *
 * Later you can add:
 *   GET /api/users        -> list users
 *   GET /api/users/:id    -> get single user
 *   PUT /api/users/:id    -> update user
 *   DELETE /api/users/:id -> soft delete user, etc.
 */

import express from "express";
import multer from "multer";
import { createUser,updateAvatar  } from "../controller/userController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Store file in memory so we can use it with sharp
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});


/**
 * POST /api/users
 *
 * Create a new user.
 * In the future this route should be protected with authentication
 * and authorization middleware (e.g. only admins can create users).
 */
router.post("/", createUser);

/**
 * PUT /api/users/me/avatar
 * Update the currently authenticated user's profile picture.
 * Expects multipart/form-data with field name "avatar".
 */
router.put(
  "/me/avatar",
  requireAuth,
  upload.single("avatar"),
  updateAvatar
);

export default router;
