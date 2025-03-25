// routes/authRoutes.js
import express from 'express';
import { google } from 'googleapis';
import handleLogin from '../controllers/authController.js';
import { handleGoogleAuth } from '../controllers/googleAuthController.js';
import { saveTokens, getTokens } from '../tokenStore.js';
import {
	forgotPassword,
	verifyResetCode,
	resetPassword,
} from '../controllers/forgotPassController.js';

const router = express.Router();

// POST /auth/ - Login endpoint
router.post('/', handleLogin);

// POST /auth/google - Google authentication (sign-up/login)
router.post('/google', handleGoogleAuth);

/**
 * POST /auth/exchange-code
 * Expects a JSON body with { code, userId }.
 * Exchanges the provided auth code for tokens and saves them.
 */
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

		// Exchange the code for tokens
		const { tokens } = await oauth2Client.getToken(code);
		console.log('Tokens received:', tokens);

		// If no refresh token is provided (common on repeat logins), merge the previously stored one
		if (!tokens.refresh_token) {
			const storedTokens = await getTokens(userId);
			if (storedTokens && storedTokens.refresh_token) {
				console.log('Merging previously saved refresh token.');
				tokens.refresh_token = storedTokens.refresh_token;
			}
		}

		// Save tokens to MongoDB
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

/**
 * GET /auth/current-token
 * Expects a query parameter ?userId=...
 * Retrieves the stored access token for the given user.
 */
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

/**
 * POST /auth/forgot-password
 * Expects a JSON body with { email }.
 * Sends a reset code to the provided email.
 */
router.post('/forgot-password', forgotPassword);

/**
 * POST /auth/verify-code
 * Expects a JSON body with { email, code }.
 * Verifies the reset code.
 */
router.post('/verify-code', verifyResetCode);

/**
 * POST /auth/reset-password
 * Expects a JSON body with { email, code, newPassword }.
 * Resets the user's password.
 */
router.post('/reset-password', resetPassword);

export default router;
