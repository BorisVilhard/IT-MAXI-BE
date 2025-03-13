import express from 'express';
import { getJobsByRoleType } from '../controllers/profileController.js';

const router = express.Router();

router.get('/job-descriptions/:roleType', getJobsByRoleType);

export default router;
