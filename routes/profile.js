import express from 'express';
import {
	getAllJobDescriptions,
	getJobsByRoleType,
	createOrUpdateProfile,
	getProfile,
	getAvatar,
	getBackground,
	getCarouselImage,
	getCourseThumbnail,
	createInteraction,
	getInteractions,
} from '../controllers/profileController.js';
import verifyJWT from '../middleware/verifyJWT.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }).fields([
	{ name: 'avatarUrl', maxCount: 1 },
	{ name: 'backgroundUrl', maxCount: 1 },
	{ name: 'carouselImages', maxCount: 10 },
	{ name: 'courseThumbnails', maxCount: 10 },
]);

router.post('/', verifyJWT, upload, createOrUpdateProfile);
router.post('/interactions', verifyJWT, createInteraction);
router.get('/interactions', verifyJWT, getInteractions);
router.get('/:userId', verifyJWT, getProfile);
router.get('/:userId/avatar', getAvatar);
router.get('/:userId/background', getBackground);
router.get('/:userId/carousel/:carouselId/image', getCarouselImage);
router.get('/:userId/courses/:courseId/thumbnail', getCourseThumbnail);

export default router;
