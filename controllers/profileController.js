import Profile from '../model/Profile.js'; // Adjust the import based on your project structure
import { processImage } from '../utils/imageProcessor.js'; // Utility to process image buffers

export const createOrUpdateProfile = async (req, res) => {
	try {
		if (!req.user || !req.user.id) {
			return res.status(401).json({ message: 'Unauthorized' });
		}
		const userId = req.user.id;

		// Extract text fields from req.body
		const {
			tagline,
			industry,
			location,
			size,
			bio,
			phone,
			email,
			website,
			github,
			carousel, // JSON string of carousel items
		} = req.body;
		console.log('req.body:', req.body);
		console.log('req.files:', req.files);
		// Extract uploaded files from req.files (set by Multer)
		const avatarFile =
			req.files && req.files.avatarUrl ? req.files.avatarUrl[0] : null;
		const backgroundFile =
			req.files && req.files.backgroundUrl ? req.files.backgroundUrl[0] : null;
		const carouselFiles =
			req.files && req.files.carouselImages ? req.files.carouselImages : [];

		// Find existing profile
		const existingProfile = await Profile.findOne({ userId });

		// Prepare profile data, preserving existing values if not updated
		const profileData = {
			userId,
			tagline: tagline || (existingProfile ? existingProfile.tagline : ''),
			industry: industry || (existingProfile ? existingProfile.industry : ''),
			location: location || (existingProfile ? existingProfile.location : ''),
			size: size || (existingProfile ? existingProfile.size : ''),
			bio: bio || (existingProfile ? existingProfile.bio : ''),
			phone: phone || (existingProfile ? existingProfile.phone : ''),
			email: email || (existingProfile ? existingProfile.email : ''),
			website: website || (existingProfile ? existingProfile.website : ''),
			github: github || (existingProfile ? existingProfile.github : ''),
		};

		// Process and store avatar image
		if (avatarFile) {
			const processedAvatar = await processImage(avatarFile.buffer);
			profileData.avatar = {
				data: processedAvatar,
				contentType: avatarFile.mimetype,
			};
		} else if (existingProfile && existingProfile.avatar) {
			profileData.avatar = existingProfile.avatar;
		}

		// Process and store background image
		if (backgroundFile) {
			const processedBg = await processImage(backgroundFile.buffer);
			profileData.background = {
				data: processedBg,
				contentType: backgroundFile.mimetype,
			};
		} else if (existingProfile && existingProfile.background) {
			profileData.background = existingProfile.background;
		}

		// Process carousel items
		const carouselData = carousel ? JSON.parse(carousel) : [];
		const processedCarousel = [];
		let fileIndex = 0;

		for (const item of carouselData) {
			const newItem = {
				category: item.category || '',
				title: item.title || '',
				content: item.content || '',
			};

			// Handle new carousel image uploads
			if (item.src === 'new_file' && fileIndex < carouselFiles.length) {
				const processedImage = await processImage(
					carouselFiles[fileIndex].buffer
				);
				newItem.image = {
					data: processedImage,
					contentType: carouselFiles[fileIndex].mimetype,
				};
				fileIndex++;
			} else if (existingProfile && item._id) {
				// Retain existing image if updating an existing item
				const existingItem = existingProfile.carousel.id(item._id);
				if (existingItem) {
					newItem.image = existingItem.image;
				}
			}

			processedCarousel.push(newItem);
		}
		profileData.carousel = processedCarousel;

		// Create or update the profile in the database
		let updatedProfile;
		if (existingProfile) {
			updatedProfile = await Profile.findOneAndUpdate(
				{ userId },
				{ $set: profileData },
				{ new: true, runValidators: true }
			);
		} else {
			updatedProfile = await new Profile(profileData).save();
		}

		// Construct response with image URLs
		const baseUrl = 'http://localhost:3500/profile'; // Adjust base URL as needed
		const responseProfile = {
			...updatedProfile.toObject(),
			avatarUrl: updatedProfile.avatar ? `${baseUrl}/${userId}/avatar` : null,
			backgroundUrl: updatedProfile.background
				? `${baseUrl}/${userId}/background`
				: null,
			carousel: updatedProfile.carousel.map((item) => ({
				...item.toObject(),
				imageUrl: item.image
					? `${baseUrl}/${userId}/carousel/${item._id}/image`
					: null,
			})),
		};

		return res.status(200).json({
			message: existingProfile
				? 'Profile updated successfully'
				: 'Profile created successfully',
			profile: responseProfile,
		});
	} catch (error) {
		console.error('Error in createOrUpdateProfile:', error);
		return res
			.status(500)
			.json({ message: 'Server error', error: error.message });
	}
};

/**
 * Retrieves a user's profile by userId, including image URLs.
 * Only the profile owner or an admin can access it.
 */
export const getProfile = async (req, res) => {
	try {
		const { userId } = req.params;

		// Authorization check
		if (req.user.id !== userId && !req.user.roles.includes('admin')) {
			return res.status(403).json({ message: 'Unauthorized' });
		}

		const profile = await Profile.findOne({ userId });
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}

		const baseUrl = 'http://localhost:3500/profile'; // Adjust base URL as needed
		const profileData = profile.toObject();
		profileData.avatarUrl = profile.avatar
			? `${baseUrl}/${userId}/avatar`
			: null;
		profileData.backgroundUrl = profile.background
			? `${baseUrl}/${userId}/background`
			: null;
		profileData.carousel = profile.carousel.map((item) => ({
			...item.toObject(),
			imageUrl: item.image
				? `${baseUrl}/${userId}/carousel/${item._id}/image`
				: null,
		}));

		res.status(200).json(profileData);
	} catch (error) {
		console.error('Error in getProfile:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

/**
 * Serves the avatar image for a given userId.
 */
export const getAvatar = async (req, res) => {
	try {
		const { userId } = req.params;
		const profile = await Profile.findOne({ userId });
		if (!profile || !profile.avatar) {
			return res.status(404).json({ message: 'Avatar not found' });
		}
		res.set('Content-Type', profile.avatar.contentType);
		res.send(profile.avatar.data);
	} catch (error) {
		console.error('Error in getAvatar:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

/**
 * Serves the background image for a given userId.
 */
export const getBackground = async (req, res) => {
	try {
		const { userId } = req.params;
		const profile = await Profile.findOne({ userId });
		if (!profile || !profile.background) {
			return res.status(404).json({ message: 'Background image not found' });
		}
		res.set('Content-Type', profile.background.contentType);
		res.send(profile.background.data);
	} catch (error) {
		console.error('Error in getBackground:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

/**
 * Serves a specific carousel image for a given userId and carouselId.
 */
export const getCarouselImage = async (req, res) => {
	try {
		const { userId, carouselId } = req.params;
		const profile = await Profile.findOne({ userId });
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}
		const carouselItem = profile.carousel.id(carouselId);
		if (!carouselItem || !carouselItem.image) {
			return res.status(404).json({ message: 'Carousel image not found' });
		}
		res.set('Content-Type', carouselItem.image.contentType);
		res.send(carouselItem.image.data);
	} catch (error) {
		console.error('Error in getCarouselImage:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};
