import express from 'express';
import { getAllJobDescriptions } from '../controllers/profileController.js';

const router = express.Router();

router.get('/job-descriptions', getAllJobDescriptions);

export default router;
