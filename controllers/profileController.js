import Profile from '../model/Profile.js';
import { processImage } from '../utils/imageProcessor.js';
import mongoose from 'mongoose';

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
			courses,
		} = req.body;

		const avatarFile = req.files?.avatarUrl ? req.files.avatarUrl[0] : null;
		const backgroundFile = req.files?.backgroundUrl
			? req.files.backgroundUrl[0]
			: null;
		const carouselFiles = req.files?.carouselImages
			? Object.values(req.files.carouselImages)
			: [];
		const courseThumbnailFiles = req.files?.courseThumbnails
			? Object.values(req.files.courseThumbnails)
			: [];

		const existingProfile = await Profile.findOne({ userId });
		const user = await mongoose.model('User').findById(userId);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

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
			if (!processedAvatar) throw new Error('Failed to process avatar');
			profileData.avatar = {
				data: processedAvatar,
				contentType: avatarFile.mimetype,
			};
		} else if (existingProfile?.avatar) {
			profileData.avatar = existingProfile.avatar;
		}

		if (backgroundFile) {
			const processedBg = await processImage(backgroundFile.buffer);
			if (!processedBg) throw new Error('Failed to process background');
			profileData.background = {
				data: processedBg,
				contentType: backgroundFile.mimetype,
			};
		} else if (existingProfile?.background) {
			profileData.background = existingProfile.background;
		}

		const carouselData = carousel ? JSON.parse(carousel) : [];
		const processedCarousel = [];
		let carouselFileIndex = 0;

		for (const item of carouselData) {
			const newItem = {
				category: item.category || '',
				title: item.title || '',
				content: item.content || '',
			};
			if (item._id && existingProfile) {
				const existingItem = existingProfile.carousel.find(
					(existing) => existing._id.toString() === item._id
				);
				if (existingItem) {
					newItem._id = existingItem._id;
					if (
						item.src === 'new_file' &&
						carouselFileIndex < carouselFiles.length
					) {
						const processedImage = await processImage(
							carouselFiles[carouselFileIndex].buffer
						);
						if (!processedImage)
							throw new Error(
								`Failed to process carousel image ${carouselFileIndex}`
							);
						newItem.image = {
							data: processedImage,
							contentType: carouselFiles[carouselFileIndex].mimetype,
						};
						carouselFileIndex++;
					} else {
						newItem.image = existingItem.image;
					}
				}
			} else if (
				item.src === 'new_file' &&
				carouselFileIndex < carouselFiles.length
			) {
				const processedImage = await processImage(
					carouselFiles[carouselFileIndex].buffer
				);
				if (!processedImage)
					throw new Error(
						`Failed to process carousel image ${carouselFileIndex}`
					);
				newItem.image = {
					data: processedImage,
					contentType: carouselFiles[carouselFileIndex].mimetype,
				};
				carouselFileIndex++;
			}
			processedCarousel.push(newItem);
		}
		profileData.carousel = processedCarousel;

		const coursesData = courses ? JSON.parse(courses) : [];
		console.log('Incoming courses data:', JSON.stringify(coursesData, null, 2));
		console.log(
			'courseThumbnailFiles:',
			courseThumbnailFiles.map((f) => ({
				originalname: f.originalname,
				size: f.size,
			}))
		);
		const processedCourses = [];

		for (let i = 0; i < coursesData.length; i++) {
			const course = coursesData[i];
			if (!course.author || !course.author.username) {
				console.warn(
					'Course missing author.username, setting default:',
					course
				);
			}
			const newCourse = {
				title: course.title || '',
				description: course.description || '',
				linkToVideo: course.url || '',
				tags: course.tags || [],
				price: {
					amount: course.priceAmount || 0,
					currency: course.priceCurrency || 'EUR',
				},
				websiteLink: course.websiteLink || '',
				author: {
					username: course.author?.username || user.username || 'Unknown',
					avatar: course.author?.avatarUrl
						? existingProfile?.avatar
						: existingProfile?.avatar || null,
				},
			};

			if (course._id && existingProfile) {
				const existingCourse = existingProfile.courses.find(
					(c) => c._id.toString() === course._id
				);
				if (existingCourse) {
					newCourse._id = existingCourse._id;
					newCourse.thumbnail = existingCourse.thumbnail;
					newCourse.author = existingCourse.author;
				}
			}

			if (course.thumbnail === 'new_file' && i < courseThumbnailFiles.length) {
				console.log(
					`Processing thumbnail for course ${i}:`,
					courseThumbnailFiles[i].originalname
				);
				const processedThumbnail = await processImage(
					courseThumbnailFiles[i].buffer
				);
				if (!processedThumbnail) {
					console.error(`Failed to process thumbnail for course ${i}`);
					newCourse.thumbnail = null; // Explicitly set to null if processing fails
				} else {
					newCourse.thumbnail = {
						data: processedThumbnail,
						contentType: courseThumbnailFiles[i].mimetype || 'image/jpeg', // Default to jpeg if mimetype is missing
					};
					console.log(
						`Thumbnail processed successfully for course ${i}, size:`,
						processedThumbnail.length
					);
				}
			} else if (
				!newCourse.thumbnail &&
				course.thumbnail &&
				!course.thumbnail.startsWith('new_file')
			) {
				console.log(
					`Preserving existing thumbnail for course ${i}:`,
					course.thumbnail
				);
				newCourse.thumbnail = course.thumbnail; // Should be a URL or existing buffer
			} else {
				console.log(
					`No thumbnail action for course ${i}, thumbnail field:`,
					course.thumbnail
				);
			}

			console.log('Processed course:', JSON.stringify(newCourse, null, 2));
			processedCourses.push(newCourse);
		}
		profileData.courses = processedCourses;

		console.log(
			'Saving profile data with courses:',
			JSON.stringify(profileData.courses, null, 2)
		);
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

		console.log(
			'Saved profile courses:',
			JSON.stringify(updatedProfile.courses, null, 2)
		);

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
			courses: updatedProfile.courses.map((course) => ({
				...course.toObject(),
				thumbnailUrl: course.thumbnail
					? `${baseUrl}/${userId}/courses/${course._id}/thumbnail?v=${timestamp}`
					: null,
				author: {
					username: course.author.username,
					avatarUrl: course.author.avatar
						? `${baseUrl}/${userId}/avatar?v=${timestamp}`
						: null,
				},
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

export const getCourseThumbnail = async (req, res) => {
	try {
		const { userId, courseId } = req.params;
		const profile = await Profile.findOne({ userId });
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}
		const course = profile.courses.id(courseId);
		console.log(
			`Fetching thumbnail for course ${courseId}:`,
			course?.thumbnail || 'No thumbnail'
		);
		if (!course || !course.thumbnail || !course.thumbnail.data) {
			return res.status(404).json({ message: 'Course thumbnail not found' });
		}
		res.set('Content-Type', course.thumbnail.contentType || 'image/jpeg'); // Default to jpeg if undefined
		res.send(course.thumbnail.data);
	} catch (error) {
		console.error('Error in getCourseThumbnail:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

// Other endpoints (getProfile, getAvatar, getBackground, getCarouselImage) remain unchanged
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
			courses: profile.courses.map((course) => ({
				...course.toObject(),
				thumbnailUrl: course.thumbnail
					? `${baseUrl}/${userId}/courses/${course._id}/thumbnail?v=${timestamp}`
					: null,
				author: {
					username: course.author.username,
					avatarUrl: course.author.avatar
						? `${baseUrl}/${userId}/avatar?v=${timestamp}`
						: null,
				},
			})),
		};
		res.status(200).json(profileData);
	} catch (error) {
		console.error('Error in getProfile:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

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
