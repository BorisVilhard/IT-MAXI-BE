// routes/usersRoutes.js
import express from 'express';
import verifyJWT from '../middleware/verifyJWT.js';
import {
	getUser,
	updateUser,
	deleteUser,
	getAllUsers,
} from '../controllers/usersController.js';

const router = express.Router();

// Apply JWT verification middleware to all routes in this file.
router.use(verifyJWT);

/**
 * GET /users/
 * Retrieve a list of all users.
 */
router.get('/', getAllUsers);

/**
 * GET /users/:id
 * Retrieve details for a single user by ID.
 */
router.get('/:id', getUser);

/**
 * PUT /users/:id
 * Update a user's details.
 */
router.put('/:id', updateUser);

/**
 * DELETE /users/:id
 * Delete a user.
 */
router.delete('/:id', deleteUser);

export default router;
