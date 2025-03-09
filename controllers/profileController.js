import Profile from '../model/Profile.js'; // Adjust the import based on your project structure
import { processImage } from '../utils/imageProcessor.js'; // Utility to process image buffers

export const createOrUpdateProfile = async (req, res) => {
	try {
		// Check if the user is authenticated
		if (!req.user || !req.user.id) {
			return res.status(401).json({ message: 'Unauthorized' });
		}
		const userId = req.user.id;

		// Extract data from request body
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
			carousel,
		} = req.body;

		// Extract uploaded files (avatar, background, and carousel images)
		const avatarFile =
			req.files && req.files.avatarUrl ? req.files.avatarUrl[0] : null;
		const backgroundFile =
			req.files && req.files.backgroundUrl ? req.files.backgroundUrl[0] : null;
		const carouselFiles =
			req.files && req.files.carouselImages ? req.files.carouselImages : [];

		// Check if a profile already exists for the user
		const existingProfile = await Profile.findOne({ userId });

		// Prepare profile data, preserving existing values if new ones aren't provided
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

		// Handle avatar image (new upload or preserve existing)
		if (avatarFile) {
			const processedAvatar = await processImage(avatarFile.buffer);
			profileData.avatar = {
				data: processedAvatar,
				contentType: avatarFile.mimetype,
			};
		} else if (existingProfile && existingProfile.avatar) {
			profileData.avatar = existingProfile.avatar;
		}

		// Handle background image (new upload or preserve existing)
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

			// Handle existing carousel items
			if (item._id && existingProfile) {
				const existingItem = existingProfile.carousel.find(
					(existing) => existing._id.toString() === item._id
				);
				if (existingItem) {
					newItem._id = existingItem._id;
					if (item.src === 'new_file' && fileIndex < carouselFiles.length) {
						// New image provided for existing item
						const processedImage = await processImage(
							carouselFiles[fileIndex].buffer
						);
						newItem.image = {
							data: processedImage,
							contentType: carouselFiles[fileIndex].mimetype,
						};
						fileIndex++;
					} else {
						// Preserve existing image
						newItem.image = existingItem.image;
					}
				}
			} else {
				// Handle new carousel items
				if (fileIndex < carouselFiles.length) {
					const processedImage = await processImage(
						carouselFiles[fileIndex].buffer
					);
					newItem.image = {
						data: processedImage,
						contentType: carouselFiles[fileIndex].mimetype,
					};
					fileIndex++;
				} else {
					// Error: new carousel items require an image
					throw new Error('All carousel items must have an image');
				}
			}

			processedCarousel.push(newItem);
		}
		profileData.carousel = processedCarousel;

		// Save or update the profile in the database
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
		const baseUrl = 'http://localhost:3500/profile';
		const timestamp = updatedProfile.updatedAt.getTime();
		const responseProfile = {
			...updatedProfile.toObject(),
			avatarUrl: updatedProfile.avatar
				? `${baseUrl}/${userId}/avatar?v=${timestamp}`
				: null,
			backgroundUrl: updatedProfile.background
				? `${baseUrl}/${userId}/background?v=${timestamp}`
				: null,
			carousel: updatedProfile.carousel.map((item) => ({
				...item.toObject(),
				imageUrl: item.image
					? `${baseUrl}/${userId}/carousel/${item._id}/image?v=${timestamp}`
					: null,
			})),
		};

		// Send success response
		return res.status(200).json({
			message: existingProfile
				? 'Profile updated successfully'
				: 'Profile created successfully',
			profile: responseProfile,
		});
	} catch (error) {
		// Handle errors
		console.error('Error in createOrUpdateProfile:', error);
		return res
			.status(500)
			.json({ message: 'Server error', error: error.message });
	}
};

export const getProfile = async (req, res) => {
	try {
		const { userId } = req.params;

		if (req.user.id !== userId && !req.user.roles.includes('admin')) {
			return res.status(403).json({ message: 'Unauthorized' });
		}

		const profile = await Profile.findOne({ userId });
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}

		const baseUrl = 'http://localhost:3500/profile';
		const timestamp = profile.updatedAt.getTime();
		const profileData = {
			...profile.toObject(),
			avatarUrl: profile.avatar
				? `${baseUrl}/${userId}/avatar?v=${timestamp}`
				: null,
			backgroundUrl: profile.background
				? `${baseUrl}/${userId}/background?v=${timestamp}`
				: null,
			carousel: profile.carousel.map((item) => ({
				...item.toObject(),
				imageUrl: item.image
					? `${baseUrl}/${userId}/carousel/${item._id}/image?v=${timestamp}`
					: null,
			})),
		};

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
