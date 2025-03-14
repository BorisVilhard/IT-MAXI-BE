import express from 'express';
import {
	getJobsByRoleType,
	getAllCourses,
} from '../controllers/profileController.js';

const router = express.Router();

router.get('/job-descriptions/:roleType', getJobsByRoleType);
router.get('/courses', getAllCourses);

export default router;
