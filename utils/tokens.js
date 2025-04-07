import { sign } from 'jsonwebtoken';

const EXPIRE_TIME = 24 * 60 * 60 * 1000;

export const generateJWTTokens = async (user) => {
	const payload = {
		id: user?._id,
		email: user?.email,
	};
	const accessToken = sign(payload, process.env.ACCESS_TOKEN_JTW_SECRET, {
		expiresIn: '1d',
	});
	const refreshToken = sign(payload, process.env.REFRESH_TOKEN_JTW_SECRET, {
		expiresIn: '7d',
	});

	return {
		accessToken,
		refreshToken,
		expiresIn: new Date().setTime(new Date().getTime() + EXPIRE_TIME),
	};
};
