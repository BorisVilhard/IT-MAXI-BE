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
	getAllJobDescriptions,
	deleteInteraction,
	updateInteraction,
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

// Protected routes (JWT required)
router.post('/', verifyJWT, upload, createOrUpdateProfile);
router.get('/interactions', verifyJWT, getInteractions);
router.put('/interactions/:interactionId', verifyJWT, updateInteraction);
router.delete('/interactions/:interactionId', verifyJWT, deleteInteraction);
router.post('/interactions', verifyJWT, createInteraction);
router.get('/:userId/cv', verifyJWT, getCV);
router.post('/jobs', verifyJWT, createJobDescription);
router.put('/jobs/:jobId', verifyJWT, updateJobDescription);
router.delete('/jobs/:jobId', verifyJWT, deleteJobDescription);

// Public routes (no JWT required)
// Place routes with dynamic parameters AFTER specific routes to avoid route matching conflicts
router.get('/job-descriptions/:roleType', getJobsByRoleType);
router.get('/courses', getAllCourses);
router.get('/:userId/avatar', getAvatar);
router.get('/:userId/background', getBackground);
router.get('/:userId/carousel/:carouselId/image', getCarouselImage);
router.get('/:userId/courses/:courseId/thumbnail', getCourseThumbnail);
router.get('/:userId', getProfile);

export default router;
