import User from '../model/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const handleLogin = async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res
				.status(400)
				.json({ message: 'Email and password are required' });
		}

		console.log('Received:', { email, password });

		const foundUser = await User.findOne({ email }).exec();
		console.log('User found:', foundUser);

		if (!foundUser) {
			return res.status(401).json({ message: 'Invalid email or password' });
		}

		const match = await bcrypt.compare(password, foundUser.password);
		console.log('Password match:', match);

		if (!match) {
			return res.status(401).json({ message: 'Invalid email or password' });
		}

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

		const refreshToken = jwt.sign(
			{ username: foundUser.username },
			process.env.REFRESH_TOKEN_SECRET,
			{ expiresIn: '1d' }
		);

		foundUser.refreshToken = refreshToken;
		await foundUser.save();

		res.cookie('refreshToken', refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			maxAge: 24 * 60 * 60 * 1000,
		});

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

export const handleRefreshToken = async (req, res) => {
	const cookies = req.cookies;
	if (!cookies?.jwt) return res.sendStatus(401);

	const refreshToken = cookies.jwt;

	try {
		const foundUser = await User.findOne({ refreshToken }).exec();
		if (!foundUser) return res.sendStatus(403);

		jwt.verify(
			refreshToken,
			process.env.REFRESH_TOKEN_SECRET,
			(err, decoded) => {
				if (err || foundUser.username !== decoded.username)
					return res.sendStatus(403);

				const roles = Object.values(foundUser.roles || {});

				const newAccessToken = jwt.sign(
					{
						UserInfo: {
							id: foundUser._id,
							username: foundUser.username,
							email: foundUser.email,
							roles: roles,
						},
					},
					process.env.ACCESS_TOKEN_SECRET,
					{ expiresIn: '1d' }
				);

				res.json({ accessToken: newAccessToken });
			}
		);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: 'Internal server error' });
	}
};
