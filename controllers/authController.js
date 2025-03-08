import User from '../model/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const handleLogin = async (req, res) => {
	try {
		// Extract email and password from request body
		const { email, password } = req.body;

		if (!email || !password) {
			return res
				.status(400)
				.json({ message: 'Email and password are required' });
		}

		console.log('Received:', { email, password });

		// Find user by email
		const foundUser = await User.findOne({ email }).exec();
		console.log('User found:', foundUser);

		if (!foundUser) {
			return res.status(401).json({ message: 'Invalid email or password' });
		}

		// Compare provided password with stored hashed password
		const match = await bcrypt.compare(password, foundUser.password);
		console.log('Password match:', match);

		if (!match) {
			return res.status(401).json({ message: 'Invalid email or password' });
		}

		// Generate access token
		const accessToken = jwt.sign(
			{
				UserInfo: {
					id: foundUser._id,
					username: foundUser.username,
					email: foundUser.email,
				},
			},
			process.env.ACCESS_TOKEN_SECRET,
			{ expiresIn: '1d' }
		);

		// Generate refresh token
		const refreshToken = jwt.sign(
			{ username: foundUser.username },
			process.env.REFRESH_TOKEN_SECRET,
			{ expiresIn: '1d' }
		);

		// Save refresh token to user document
		foundUser.refreshToken = refreshToken;
		await foundUser.save();

		// Set refresh token as HTTP-only cookie
		res.cookie('refreshToken', refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			maxAge: 24 * 60 * 60 * 1000, // 1 day
		});

		// Send response with access token and user details
		res.status(200).json({
			id: foundUser._id,
			username: foundUser.username,
			email: foundUser.email,
			accessToken,
			...(foundUser.regNumber && { regNumber: foundUser.regNumber }),
			...(foundUser.registeredAddress && {
				registeredAddress: foundUser.registeredAddress,
			}),
		});
	} catch (err) {
		console.error('Login error:', err.message);
		res
			.status(500)
			.json({ message: 'Internal Server Error', error: err.message });
	}
};

export default handleLogin;
