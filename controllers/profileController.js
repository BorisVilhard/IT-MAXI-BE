import Profile from '../model/Profile.js'; // Adjust the import based on your project structure
import { processImage } from '../utils/imageProcessor.js'; // Utility to process image buffers

export const createOrUpdateProfile = async (req, res) => {
	try {
		if (!req.user || !req.user.id) {
			return res.status(401).json({ message: 'Unauthorized' });
		}
		const userId = req.user.id;

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
		const avatarFile =
			req.files && req.files.avatarUrl ? req.files.avatarUrl[0] : null;
		const backgroundFile =
			req.files && req.files.backgroundUrl ? req.files.backgroundUrl[0] : null;
		const carouselFiles =
			req.files && req.files.carouselImages ? req.files.carouselImages : [];

		const existingProfile = await Profile.findOne({ userId });

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

		if (avatarFile) {
			const processedAvatar = await processImage(avatarFile.buffer);
			profileData.avatar = {
				data: processedAvatar,
				contentType: avatarFile.mimetype,
			};
		} else if (existingProfile && existingProfile.avatar) {
			profileData.avatar = existingProfile.avatar;
		}

		if (backgroundFile) {
			const processedBg = await processImage(backgroundFile.buffer);
			profileData.background = {
				data: processedBg,
				contentType: backgroundFile.mimetype,
			};
		} else if (existingProfile && existingProfile.background) {
			profileData.background = existingProfile.background;
		}

		const carouselData = carousel ? JSON.parse(carousel) : [];
		const processedCarousel = [];
		let fileIndex = 0;

		for (const item of carouselData) {
			const newItem = {
				category: item.category || '',
				title: item.title || '',
				content: item.content || '',
			};

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
				const existingItem = existingProfile.carousel.id(item._id);
				if (existingItem) {
					newItem.image = existingItem.image;
				}
			}

			processedCarousel.push(newItem);
		}
		profileData.carousel = processedCarousel;

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
