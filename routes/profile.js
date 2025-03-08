import multer from 'multer';
import express from 'express';
import verifyJWT from '../middleware/verifyJWT.js';
import {
	createOrUpdateProfile,
	getProfile,
	getAvatar,
	getBackground,
	getCarouselImage,
} from '../controllers/profileController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }).fields([
	{ name: 'avatarUrl', maxCount: 1 },
	{ name: 'backgroundUrl', maxCount: 1 },
	{ name: 'carouselImages', maxCount: 10 },
]);

router.post('/', verifyJWT, upload, createOrUpdateProfile);
router.get('/:userId', verifyJWT, getProfile);
router.get('/:userId/avatar', getAvatar);
router.get('/:userId/background', getBackground);
router.get('/:userId/carousel/:carouselId/image', getCarouselImage);

export default router;
