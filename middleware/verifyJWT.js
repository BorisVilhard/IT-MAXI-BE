import jwt from 'jsonwebtoken';

const verifyJWT = (req, res, next) => {
	const authHeader = req.headers.authorization || req.headers.Authorization;
	const token = authHeader?.startsWith('Bearer ')
		? authHeader.split(' ')[1]
		: req.query.token;

	if (!token) {
		console.log('No token found');
		return res.status(401).json({ message: 'Unauthorized: Missing token' });
	}

	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			console.log('Token verification error:', err);
			return res.status(403).json({ message: 'Forbidden: Invalid token' });
		}
		console.log('Decoded Token:', decoded);
		req.user = decoded.UserInfo;
		next();
	});
};

export default verifyJWT;
