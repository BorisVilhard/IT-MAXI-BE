import express from 'express';
import { google } from 'googleapis';
import {
	handleLogin,
	handleRefreshToken,
} from '../controllers/authController.js';
import { handleGoogleAuth } from '../controllers/googleAuthController.js';
import { saveTokens, getTokens } from '../tokenStore.js';
import {
	forgotPassword,
	verifyResetCode,
	resetPassword,
} from '../controllers/forgotPassController.js';
import {
	sendVerificationCode,
	verifyRegistration,
} from '../controllers/registerController.js'; // Import new controller functions

const router = express.Router();

router.post('/', handleLogin);
router.post('/google', handleGoogleAuth);
router.post('/exchange-code', async (req, res) => {
	const { code, userId } = req.body;
	if (!code) return res.status(400).json({ error: 'Missing auth code' });
	if (!userId) return res.status(400).json({ error: 'Missing user ID' });

	try {
		const oauth2Client = new google.auth.OAuth2(
			process.env.GOOGLE_CLIENT_ID,
			process.env.GOOGLE_CLIENT_SECRET,
			process.env.GOOGLE_REDIRECT_URI
		);

		const { tokens } = await oauth2Client.getToken(code);
		console.log('Tokens received:', tokens);

		if (!tokens.refresh_token) {
			const storedTokens = await getTokens(userId);
			if (storedTokens && storedTokens.refresh_token) {
				console.log('Merging previously saved refresh token.');
				tokens.refresh_token = storedTokens.refresh_token;
			}
		}

		await saveTokens(userId, tokens);
		return res
			.status(200)
			.json({ message: 'Tokens saved successfully', tokens });
	} catch (error) {
		console.error('Error exchanging code:', error);
		return res.status(500).json({
			error: 'Failed to exchange code',
			details: error.response?.data || error.message,
		});
	}
});

router.get('/current-token', async (req, res) => {
	const { userId } = req.query;
	if (!userId) return res.status(400).json({ error: 'Missing user ID' });

	try {
		const tokens = await getTokens(userId);
		const access_token = tokens ? tokens.access_token : null;
		if (!access_token) {
			return res.status(401).json({ error: 'No access token available' });
		}
		return res.status(200).json({ accessToken: access_token });
	} catch (error) {
		console.error('Error retrieving current token:', error);
		return res.status(500).json({ error: 'Error retrieving current token' });
	}
});

router.get('/refresh-token', handleRefreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/verify-code', verifyResetCode);
router.post('/reset-password', resetPassword);

// New endpoints for registration
router.post('/send-verification-code', sendVerificationCode);
router.post('/verify-registration', verifyRegistration);

export default router;
