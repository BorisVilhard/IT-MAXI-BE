import User from '../model/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendResetCodeEmail } from '../utils/email.js';

const tempRegistrationStore = new Map();

const generateVerificationCode = () => {
	return crypto.randomInt(100000, 999999).toString();
};

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

const sendVerificationCode = async (req, res) => {
	try {
		const {
			fullName,
			email,
			password,
			regNumber,
			registeredAddress,
			companyName,
		} = req.body;

		if (!fullName || !email || !password) {
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

		const verificationCode = generateVerificationCode();
		const tempId = crypto.randomBytes(16).toString('hex');

		const hashedPwd = await bcrypt.hash(password, 10);

		tempRegistrationStore.set(tempId, {
			fullName,
			email,
			password: hashedPwd,
			regNumber,
			registeredAddress,
			companyName,
			verificationCode,
			createdAt: Date.now(),
		});

		await sendResetCodeEmail(email, verificationCode);

		setTimeout(() => {
			tempRegistrationStore.delete(tempId);
		}, 10 * 60 * 1000);

		return res.status(200).json({
			message: 'Verification code sent successfully',
			tempId,
		});
	} catch (err) {
		console.error('Error sending verification code:', err.message);
		return res.status(500).json({
			message: 'Internal Server Error',
			error: err.message,
		});
	}
};

const verifyRegistration = async (req, res) => {
	try {
		const { tempId, verificationCode } = req.body;

		if (!tempId || !verificationCode) {
			return res
				.status(400)
				.json({ message: 'Temporary ID and verification code are required' });
		}

		const tempData = tempRegistrationStore.get(tempId);
		if (!tempData) {
			return res
				.status(400)
				.json({ message: 'Invalid or expired temporary ID' });
		}

		if (tempData.verificationCode !== verificationCode) {
			return res.status(400).json({ message: 'Invalid verification code' });
		}

		const newUser = await User.create({
			username: tempData.fullName,
			email: tempData.email,
			password: tempData.password,
			...(tempData.regNumber && { regNumber: tempData.regNumber }),
			...(tempData.registeredAddress && {
				registeredAddress: tempData.registeredAddress,
			}),
			...(tempData.companyName && { companyName: tempData.companyName }),
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

		tempRegistrationStore.delete(tempId);

		return res.status(201).json({
			id: newUser._id,
			username: newUser.username,
			email: newUser.email,
			accessToken,
			...(newUser.regNumber && { regNumber: newUser.regNumber }),
			...(newUser.registeredAddress && {
				registeredAddress: newUser.registeredAddress,
			}),
			...(newUser.companyName && { companyName: newUser.companyName }),
		});
	} catch (err) {
		console.error('Error verifying registration:', err.message);
		return res.status(500).json({
			message: 'Internal Server Error',
			error: err.message,
		});
	}
};

export { handleNewUser, sendVerificationCode, verifyRegistration };
