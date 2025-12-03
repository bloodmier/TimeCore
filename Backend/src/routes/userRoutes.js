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
import { createUser } from "../controller/userController.js";

const router = express.Router();

/**
 * POST /api/users
 *
 * Create a new user.
 * In the future this route should be protected with authentication
 * and authorization middleware (e.g. only admins can create users).
 */
router.post("/", createUser);

export default router;
