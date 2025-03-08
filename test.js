import bcrypt from 'bcrypt';

const password = '1234Aa+';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, async (err, hash) => {
	if (err) {
		console.error('Error hashing password:', err);
	} else {
		console.log('Generated Hash:', hash);

		// Replace with the actual hash from the database
		const storedHash = hash; // Or fetch from DB: await User.findOne(...).password
		const match = await bcrypt.compare(password, storedHash);
		console.log('Password match:', match); // Should be true
	}
});
