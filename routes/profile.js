import express from 'express';
import {
	getCV,
	createOrUpdateProfile,
	getProfile,
	getAvatar,
	getBackground,
	getCarouselImage,
	getCourseThumbnail,
	createInteraction,
	getInteractions,
	createJobDescription,
	updateJobDescription,
	deleteJobDescription,
	getJobsByRoleType,
	getAllCourses,
} from '../controllers/profileController.js';
import verifyJWT from '../middleware/verifyJWT.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }).fields([
	{ name: 'avatarUrl', maxCount: 1 },
	{ name: 'backgroundUrl', maxCount: 1 },
	{ name: 'cv', maxCount: 1 },
	{ name: 'carouselImages', maxCount: 10 },
	{ name: 'courseThumbnails', maxCount: 10 },
]);

// Public routes (no JWT required)
router.get('/job-descriptions/:roleType', getJobsByRoleType);
router.get('/courses', getAllCourses);
router.get('/:userId', getProfile);
router.get('/:userId/avatar', getAvatar);
router.get('/:userId/background', getBackground);
router.get('/:userId/carousel/:carouselId/image', getCarouselImage);
router.get('/:userId/courses/:courseId/thumbnail', getCourseThumbnail);

// Protected routes (JWT required)
router.post('/', verifyJWT, upload, createOrUpdateProfile);
router.post('/interactions', verifyJWT, createInteraction);
router.get('/interactions', verifyJWT, getInteractions);
router.get('/:userId/cv', verifyJWT, getCV);

// New protected routes for job descriptions
router.post('/jobs', verifyJWT, createJobDescription);
router.put('/jobs/:jobId', verifyJWT, updateJobDescription);
router.delete('/jobs/:jobId', verifyJWT, deleteJobDescription);

export default router;
