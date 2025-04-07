import User from '../model/User.js';
import Profile from '../model/Profile.js';
import bcrypt from 'bcrypt';

export const getAllUsers = async (req, res) => {
	try {
		const users = await User.find().select('-password');
		if (!users) return res.status(204).json({ message: 'No users found' });
		res.json(users);
	} catch (error) {
		console.error('Error fetching users:', error);
		res.status(500).json({ message: 'Server error', error });
	}
};

export const getUser = async (req, res) => {
	const { id } = req.params;
	if (!id) return res.status(400).json({ message: 'User ID required' });
	try {
		const user = await User.findOne({ _id: id }).select('-password').exec();
		if (!user) {
			return res.status(404).json({ message: `User ID ${id} not found` });
		}
		res.json(user);
	} catch (error) {
		console.error('Error fetching user:', error);
		res.status(500).json({ message: 'Server error', error });
	}
};

// controllers/usersController.js
export const updateUser = async (req, res) => {
	const { id } = req.params;
	const { username, email, password, regNumber, registeredAddress, avatarUrl } =
		req.body;

	// Validate user ID
	if (!id) {
		return res.status(400).json({ message: 'User ID required' });
	}

	// Validate regNumber and registeredAddress pairing
	const regNumberProvided = !!regNumber && regNumber.trim() !== '';
	const registeredAddressProvided =
		!!registeredAddress && registeredAddress.trim() !== '';
	if (regNumberProvided !== registeredAddressProvided) {
		return res.status(400).json({
			message:
				'Both regNumber and registeredAddress must be provided together or neither',
		});
	}

	try {
		// Find the user by ID
		const user = await User.findById(id).exec();
		if (!user) {
			return res.status(404).json({ message: `User ID ${id} not found` });
		}

		// Update password if provided
		if (password && password.trim() !== '') {
			const salt = await bcrypt.genSalt(10);
			user.password = await bcrypt.hash(password, salt);
		}

		// Update fields only if provided, otherwise retain existing values
		user.username = username || user.username;
		user.email = email || user.email;
		user.regNumber = regNumberProvided ? regNumber : user.regNumber;
		user.registeredAddress = registeredAddressProvided
			? registeredAddress
			: user.registeredAddress;

		// Save the updated user (refreshToken remains untouched)
		await user.save();

		// Update related Profile data (if applicable)
		await Profile.updateOne(
			{ userId: user._id },
			{
				$set: {
					'jobDescriptions.$[].author.username': user.username,
					'courses.$[].author.username': user.username,
					'author.0.username': user.username,
					'jobDescriptions.$[].author.avatarUrl': avatarUrl || '',
					'courses.$[].author.avatarUrl': avatarUrl || '',
					'author.0.avatarUrl': avatarUrl || '',
				},
			}
		);

		res.status(200).json({
			message: 'User updated successfully!',
			user: {
				_id: user._id,
				username: user.username,
				email: user.email,
				regNumber: user.regNumber,
				registeredAddress: user.registeredAddress,
			},
		});
	} catch (error) {
		console.error('Error updating user:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const deleteUser = async (req, res) => {
	const { id } = req.params;
	if (!id) {
		return res.status(400).json({ message: 'User ID required' });
	}
	try {
		const user = await User.findById(id);
		if (!user) {
			return res.status(404).json({ message: `User ID ${id} not found` });
		}
		await user.remove();
		res.json({ message: 'User deleted successfully' });
	} catch (error) {
		console.error('Error deleting user:', error);
		res.status(500).json({ message: 'Server error', error });
	}
};
