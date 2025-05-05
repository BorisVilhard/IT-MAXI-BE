// registerController.js
import User from '../model/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const handleNewUser = async (req, res) => {
	try {
		const {
			fullName: username,
			email,
			password,
			regNumber,
			registeredAddress,
		} = req.body;

		if (!username || !email || !password) {
			return res
				.status(400)
				.json({ message: 'Full name, email, and password are required' });
		}

		const duplicate = await User.findOne({ email }).exec();
		if (duplicate) {
			return res.status(409).json({ message: 'Email is already in use' });
		}

		if (
			(regNumber && !registeredAddress) ||
			(!regNumber && registeredAddress)
		) {
			return res.status(400).json({
				message:
					'Both registration number and registered address must be provided together',
			});
		}

		const hashedPwd = await bcrypt.hash(password, 10);

		const newUser = await User.create({
			username,
			email,
			password: hashedPwd,
			...(regNumber && { regNumber }),
			...(registeredAddress && { registeredAddress }),
			roles: ['regular'],
		});

		const accessToken = jwt.sign(
			{
				UserInfo: {
					id: newUser._id,
					username: newUser.username,
					email: newUser.email,
				},
			},
			process.env.ACCESS_TOKEN_SECRET,
			{ expiresIn: '1d' }
		);

		const refreshToken = jwt.sign(
			{ username: newUser.username },
			process.env.REFRESH_TOKEN_SECRET,
			{ expiresIn: '1d' }
		);

		newUser.refreshToken = refreshToken;
		await newUser.save();

		res.status(201).json({
			id: newUser._id,
			username: newUser.username,
			email: newUser.email,
			accessToken,
			...(regNumber && { regNumber }),
			...(registeredAddress && { registeredAddress }),
		});
	} catch (err) {
		console.error('Registration error:', err.message);
		res.status(500).json({
			message: 'Internal Server Error',
			error: err.message,
		});
	}
};

export default handleNewUser;
