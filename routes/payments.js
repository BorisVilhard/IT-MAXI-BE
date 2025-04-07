import express from 'express';
import {
	createPaymentIntent,
	createSubscriptionIntent,
} from '../controllers/paymentController.js';
import verifyJWT from '../middleware/verifyJWT.js';

const router = express.Router();

router.post('/create-payment-intent', verifyJWT, createPaymentIntent);
router.post(
	'/create-subscription-payment',
	verifyJWT,
	createSubscriptionIntent
);

export default router;
