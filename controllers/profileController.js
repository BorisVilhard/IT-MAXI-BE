import Profile from '../model/Profile.js';
import Interaction from '../model/Interaction.js';
import { processImage } from '../utils/imageProcessor.js';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';

// Simple in-memory cache
const imageCache = new Map(); // Key: string (e.g., "avatar:userId"), Value: { data, contentType, timestamp }
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

setInterval(() => {
	const now = Date.now();
	for (const [key, { timestamp }] of imageCache) {
		if (now - timestamp > CACHE_TTL) {
			imageCache.delete(key);
		}
	}
}, 60000);

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
			activeRole,
			jobDescriptions,
			jobPostVisibility,
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
		const cvFile = req.files?.cv ? req.files.cv[0] : null; // Extract CV file

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
			activeRole:
				activeRole ||
				(existingProfile ? existingProfile.activeRole : 'regular'),
			jobPostVisibility:
				jobPostVisibility !== undefined
					? jobPostVisibility === 'true'
					: existingProfile
					? existingProfile.jobPostVisibility
					: true,
		};

		// Handle avatar upload
		if (avatarFile) {
			const processedAvatar = await processImage(avatarFile.buffer);
			if (!processedAvatar) throw new Error('Failed to process avatar');
			profileData.avatar = {
				data: processedAvatar,
				contentType: avatarFile.mimetype,
			};
			imageCache.delete(`avatar:${userId}`);
		} else if (existingProfile?.avatar) {
			profileData.avatar = existingProfile.avatar;
		}

		// Handle background upload
		if (backgroundFile) {
			const processedBg = await processImage(backgroundFile.buffer);
			if (!processedBg) throw new Error('Failed to process background');
			profileData.background = {
				data: processedBg,
				contentType: backgroundFile.mimetype,
			};
			imageCache.delete(`background:${userId}`);
		} else if (existingProfile?.background) {
			profileData.background = existingProfile.background;
		}

		// Handle CV upload
		if (cvFile) {
			profileData.cv = {
				data: cvFile.buffer, // Store the binary data directly
				contentType: cvFile.mimetype,
				fileName: cvFile.originalname, // Store the MIME type
			};
		} else if (existingProfile?.cv) {
			profileData.cv = existingProfile.cv; // Retain existing CV if no new file
		}

		// Handle carousel
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
					newItem.image =
						item.src === 'new_file' && carouselFileIndex < carouselFiles.length
							? {
									data: await processImage(
										carouselFiles[carouselFileIndex].buffer
									),
									contentType: carouselFiles[carouselFileIndex].mimetype,
							  }
							: existingItem.image;
					if (item.src === 'new_file') {
						imageCache.delete(`carousel:${userId}:${existingItem._id}`);
						carouselFileIndex++;
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

		// Handle courses
		const coursesData = courses ? JSON.parse(courses) : [];
		const processedCourses = [];
		let courseFileIndex = 0;

		for (const course of coursesData) {
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
					avatarUrl:
						course.author?.avatarUrl ||
						(existingProfile?.avatar
							? `${req.protocol}://${req.get('host')}/profile/${userId}/avatar`
							: null),
				},
			};

			if (course._id && existingProfile) {
				const existingCourse = existingProfile.courses.find(
					(c) => c._id.toString() === course._id
				);
				if (existingCourse) {
					newCourse._id = existingCourse._id;
					newCourse.thumbnail =
						course.thumbnail === 'new_file' &&
						courseFileIndex < courseThumbnailFiles.length
							? {
									data: await processImage(
										courseThumbnailFiles[courseFileIndex].buffer
									),
									contentType: courseThumbnailFiles[courseFileIndex].mimetype,
							  }
							: existingCourse.thumbnail;
					if (course.thumbnail === 'new_file') {
						imageCache.delete(`course:${userId}:${existingCourse._id}`);
						courseFileIndex++;
					}
				}
			} else if (
				course.thumbnail === 'new_file' &&
				courseFileIndex < courseThumbnailFiles.length
			) {
				const processedThumbnail = await processImage(
					courseThumbnailFiles[courseFileIndex].buffer
				);
				if (!processedThumbnail)
					throw new Error(
						`Failed to process course thumbnail ${courseFileIndex}`
					);
				newCourse.thumbnail = {
					data: processedThumbnail,
					contentType: courseThumbnailFiles[courseFileIndex].mimetype,
				};
				courseFileIndex++;
			}
			processedCourses.push(newCourse);
		}
		profileData.courses = processedCourses;

		// Handle job descriptions
		const jobDescriptionsData = jobDescriptions
			? JSON.parse(jobDescriptions)
			: [];
		profileData.jobDescriptions = existingProfile?.jobDescriptions || [];
		for (const job of jobDescriptionsData) {
			const existingJob =
				job._id && existingProfile
					? existingProfile.jobDescriptions.find(
							(j) => j._id.toString() === job._id
					  )
					: null;
			const jobData = {
				_id: existingJob ? existingJob._id : undefined,
				position: job.position || (existingJob ? existingJob.position : ''),
				wageRange: job.wageRange || (existingJob ? existingJob.wageRange : ''),
				location: job.location || (existingJob ? existingJob.location : ''),
				experienceLevel:
					job.experienceLevel ||
					(existingJob ? existingJob.experienceLevel : 'Junior'),
				remoteOption:
					job.remoteOption ||
					(existingJob ? existingJob.remoteOption : 'Remote'),
				description:
					job.description || (existingJob ? existingJob.description : ''),
				jobDescription:
					job.jobDescription || (existingJob ? existingJob.jobDescription : ''),
				datePosted: job.datePosted
					? new Date(job.datePosted)
					: existingJob
					? existingJob.datePosted
					: new Date(),
				userId: job.userId || userId,
				author: {
					username: job.author?.username || user.username || 'Unknown',
					avatarUrl:
						job.author?.avatarUrl ||
						(existingProfile?.avatar
							? `${req.protocol}://${req.get('host')}/profile/${userId}/avatar`
							: null),
				},
				postActivity:
					job.postActivity !== undefined
						? job.postActivity
						: existingJob
						? existingJob.postActivity
						: false,
				roleType:
					job.roleType ||
					(existingJob
						? existingJob.roleType
						: activeRole === 'company'
						? 'company'
						: 'regular'),
			};
			if (existingJob) {
				const index = profileData.jobDescriptions.findIndex(
					(j) => j._id.toString() === job._id
				);
				profileData.jobDescriptions[index] = jobData;
			} else {
				profileData.jobDescriptions.push(jobData);
			}
		}

		// Save or update the profile
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

		// Construct response with URLs
		const baseUrl = `${req.protocol}://${req.get('host')}/profile`;
		const timestamp = updatedProfile.updatedAt.getTime();
		const responseProfile = {
			...updatedProfile.toObject(),
			avatarUrl: updatedProfile.avatar
				? `${baseUrl}/${userId}/avatar?v=${timestamp}`
				: null,
			backgroundUrl: updatedProfile.background
				? `${baseUrl}/${userId}/background?v=${timestamp}`
				: null,
			cvUrl: updatedProfile.cv ? `${baseUrl}/${userId}/cv` : null, // Add CV URL
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
					username: course.author?.username || 'Unknown',
					avatarUrl: course.author?.avatarUrl || null,
				},
			})),
			jobDescriptions: updatedProfile.jobDescriptions.map((job) => ({
				...job.toObject(),
				author: {
					username: job.author?.username || 'Unknown',
					avatarUrl: job.author?.avatarUrl || null,
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

export const getProfile = async (req, res) => {
	try {
		const { userId } = req.params;

		// Check if the user is authorized (assuming req.user is set by authentication middleware)
		if (req.user.id !== userId && !req.user.roles.includes('admin')) {
			return res.status(403).json({ message: 'Unauthorized' });
		}

		// Fetch the profile from the database, excluding binary data
		const profile = await Profile.findOne({ userId }).select(
			'-cv.data -avatar.data -background.data -carousel.image.data -courses.thumbnail.data'
		);

		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}

		// Construct the base URL for media files
		const baseUrl = `${req.protocol}://${req.get('host')}/profile`;
		const timestamp = profile.updatedAt.getTime();

		// Build the response data with URLs and CV file name
		const profileData = {
			...profile.toObject(),
			avatarUrl: profile.avatar
				? `${baseUrl}/${userId}/avatar?v=${timestamp}`
				: null,
			backgroundUrl: profile.background
				? `${baseUrl}/${userId}/background?v=${timestamp}`
				: null,
			cvUrl: profile.cv ? `${baseUrl}/${userId}/cv` : null,
			cvFileName: profile.cv ? profile.cv.fileName : null,
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
					username: course.author?.username || 'Unknown',
					avatarUrl: course.author?.avatarUrl || null,
				},
			})),
			jobDescriptions: profile.jobDescriptions.map((job) => ({
				...job.toObject(),
				author: {
					username: job.author?.username || 'Unknown',
					avatarUrl: job.author?.avatarUrl || null,
				},
			})),
		};

		// Send the response
		res.status(200).json(profileData);
	} catch (error) {
		console.error('Error in getProfile:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getAvatar = async (req, res) => {
	try {
		const { userId } = req.params;
		const cacheKey = `avatar:${userId}`;

		if (imageCache.has(cacheKey)) {
			const { data, contentType } = imageCache.get(cacheKey);
			res.set('Content-Type', contentType);
			res.set('Cache-Control', 'public, max-age=3600');
			return res.send(data);
		}

		const profile = await Profile.findOne({ userId }).select('avatar');
		if (!profile || !profile.avatar) {
			return res.status(404).json({ message: 'Avatar not found' });
		}

		imageCache.set(cacheKey, {
			data: profile.avatar.data,
			contentType: profile.avatar.contentType,
			timestamp: Date.now(),
		});

		res.set('Content-Type', profile.avatar.contentType);
		res.set('Cache-Control', 'public, max-age=3600');
		res.send(profile.avatar.data);
	} catch (error) {
		console.error('Error in getAvatar:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getBackground = async (req, res) => {
	try {
		const { userId } = req.params;
		const cacheKey = `background:${userId}`;

		if (imageCache.has(cacheKey)) {
			const { data, contentType } = imageCache.get(cacheKey);
			res.set('Content-Type', contentType);
			res.set('Cache-Control', 'public, max-age=3600');
			return res.send(data);
		}

		const profile = await Profile.findOne({ userId }).select('background');
		if (!profile || !profile.background) {
			return res.status(404).json({ message: 'Background image not found' });
		}

		imageCache.set(cacheKey, {
			data: profile.background.data,
			contentType: profile.background.contentType,
			timestamp: Date.now(),
		});

		res.set('Content-Type', profile.background.contentType);
		res.set('Cache-Control', 'public, max-age=3600');
		res.send(profile.background.data);
	} catch (error) {
		console.error('Error in getBackground:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getCarouselImage = async (req, res) => {
	try {
		const { userId, carouselId } = req.params;
		const cacheKey = `carousel:${userId}:${carouselId}`;

		if (imageCache.has(cacheKey)) {
			const { data, contentType } = imageCache.get(cacheKey);
			res.set('Content-Type', contentType);
			res.set('Cache-Control', 'public, max-age=3600');
			return res.send(data);
		}

		const profile = await Profile.findOne({ userId }).select('carousel');
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}
		const carouselItem = profile.carousel.id(carouselId);
		if (!carouselItem || !carouselItem.image) {
			return res.status(404).json({ message: 'Carousel image not found' });
		}

		imageCache.set(cacheKey, {
			data: carouselItem.image.data,
			contentType: carouselItem.image.contentType,
			timestamp: Date.now(),
		});

		res.set('Content-Type', carouselItem.image.contentType);
		res.set('Cache-Control', 'public, max-age=3600');
		res.send(carouselItem.image.data);
	} catch (error) {
		console.error('Error in getCarouselImage:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getCourseThumbnail = async (req, res) => {
	try {
		const { userId, courseId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({ message: 'Invalid user ID format' });
		}

		const cacheKey = `course:${userId}:${courseId}`;
		if (imageCache.has(cacheKey)) {
			const { data, contentType } = imageCache.get(cacheKey);
			res.set('Content-Type', contentType);
			res.set('Cache-Control', 'public, max-age=3600');
			return res.send(data);
		}

		const profile = await Profile.findOne({ userId }).select('courses');
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}

		const course = profile.courses.id(courseId);
		if (!course || !course.thumbnail) {
			return res.status(404).json({ message: 'Course thumbnail not found' });
		}

		imageCache.set(cacheKey, {
			data: course.thumbnail.data,
			contentType: course.thumbnail.contentType || 'image/jpeg',
			timestamp: Date.now(),
		});

		res.set('Content-Type', course.thumbnail.contentType || 'image/jpeg');
		res.set('Cache-Control', 'public, max-age=3600');
		res.send(course.thumbnail.data);
	} catch (error) {
		console.error('Error in getCourseThumbnail:', error);
		if (error.name === 'CastError') {
			return res.status(400).json({ message: 'Invalid user ID or course ID' });
		}
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getAllJobDescriptions = async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const roleType = req.query.roleType;
		const skip = (page - 1) * limit;

		let query = { jobPostVisibility: true };
		if (roleType) {
			query['jobDescriptions.roleType'] = roleType;
		}

		const profiles = await Profile.find(query)
			.populate('userId', 'username')
			.lean();

		const allJobDescriptions = profiles.flatMap((profile) =>
			profile.jobDescriptions
				.filter((job) => !roleType || job.roleType === roleType)
				.map((job) => ({
					...job,
					username: profile.userId?.username || 'Unknown',
					author: {
						username: job.author?.username || 'Unknown',
						avatarUrl: job.author?.avatarUrl || null,
					},
					profileActiveRole: profile.activeRole,
				}))
		);

		const total = allJobDescriptions.length;
		const paginatedJobs = allJobDescriptions.slice(skip, skip + limit);

		res.status(200).json({
			jobs: paginatedJobs,
			total,
			currentPage: page,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		console.error('Error in getAllJobDescriptions:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getJobsByRoleType = async (req, res) => {
	try {
		const { roleType } = req.params;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		if (!['regular', 'company'].includes(roleType)) {
			return res.status(400).json({ message: 'Invalid role type' });
		}

		const profiles = await Profile.find({
			jobPostVisibility: true,
			'jobDescriptions.roleType': roleType,
		})
			.populate('userId', 'username')
			.lean();

		const jobDescriptions = profiles.flatMap((profile) =>
			profile.jobDescriptions
				.filter((job) => job.roleType === roleType)
				.map((job) => ({
					...job,
					username: profile.userId?.username || 'Unknown',
					author: {
						username: job.author?.username || 'Unknown',
						avatarUrl: job.author?.avatarUrl || null,
					},
					profileActiveRole: profile.activeRole,
				}))
		);

		const total = jobDescriptions.length;
		const paginatedJobs = jobDescriptions.slice(skip, skip + limit);

		res.status(200).json({
			jobs: paginatedJobs,
			total,
			currentPage: page,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		console.error('Error in getJobsByRoleType:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getAllCourses = async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const profiles = await Profile.find({})
			.populate('userId', 'username')
			.lean();

		const allCourses = profiles.flatMap((profile) => {
			const profileUserId =
				profile.userId?._id?.toString() || profile.userId.toString();
			return profile.courses.map((course) => ({
				_id: course._id.toString(),
				title: course.title,
				description: course.description || '',
				linkToVideo: course.linkToVideo || '',
				tags: course.tags || [],
				thumbnailUrl: course.thumbnail
					? `${req.protocol}://${req.get(
							'host'
					  )}/profile/${profileUserId}/courses/${course._id}/thumbnail`
					: null,
				price: {
					amount: course.price.amount,
					currency: course.price.currency,
				},
				websiteLink: course.websiteLink || '',
				author: {
					username:
						course.author?.username || profile.userId?.username || 'Unknown',
					avatarUrl:
						course.author?.avatarUrl ||
						(profile.avatar
							? `${req.protocol}://${req.get(
									'host'
							  )}/profile/${profileUserId}/avatar`
							: null),
				},
				createdAt: course.createdAt,
				updatedAt: course.updatedAt,
			}));
		});

		const total = allCourses.length;
		const paginatedCourses = allCourses.slice(skip, skip + limit);

		res.status(200).json({
			courses: paginatedCourses,
			total,
			currentPage: page,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		console.error('Error in getAllCourses:', error);
		res.status(500).json({
			message: 'Server error',
			error: error.message,
		});
	}
};

export const createInteraction = async (req, res) => {
	try {
		const { jobId, message } = req.body;
		const senderId = req.user.id;

		const profile = await Profile.findOne({ 'jobDescriptions._id': jobId });
		if (!profile) {
			return res.status(404).json({ message: 'Job post not found' });
		}

		const job = profile.jobDescriptions.id(jobId);
		if (!job) {
			return res.status(404).json({ message: 'Job post not found' });
		}

		const recipientId = profile.userId;

		const sender = await mongoose.model('User').findById(senderId);
		const recipient = await mongoose.model('User').findById(recipientId);
		if (!sender || !recipient) {
			return res.status(404).json({ message: 'User not found' });
		}

		const senderRole = sender.roles[0];
		const recipientRole = recipient.roles[0];

		const interaction = new Interaction({
			jobId,
			senderId,
			recipientId,
			message,
		});

		await interaction.save();

		res
			.status(201)
			.json({ message: 'Interaction created successfully', interaction });
	} catch (error) {
		console.error('Error in createInteraction:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getInteractions = async (req, res) => {
	try {
		// Check if req.user is defined (set by authentication middleware)
		if (!req.user) {
			return res
				.status(401)
				.json({ message: 'Unauthorized: No user data found' });
		}

		// Safely access userId from req.user
		const userId = req.user.id;
		if (!userId) {
			return res
				.status(401)
				.json({ message: 'Unauthorized: User ID is missing' });
		}

		// Fetch interactions where the user is either the sender or recipient
		const interactions = await Interaction.find({
			$or: [{ senderId: userId }, { recipientId: userId }],
		})
			.populate('senderId', 'username email')
			.populate('recipientId', 'username email')
			.lean();

		// Manually fetch job details and profile for avatar
		const formattedInteractions = await Promise.all(
			interactions.map(async (interaction) => {
				// Find the Profile containing the jobId in its jobDescriptions array
				const profile = await Profile.findOne({
					'jobDescriptions._id': interaction.jobId,
				}).lean();

				// Extract the specific job subdocument
				let job = null;
				if (profile) {
					job = profile.jobDescriptions.find(
						(j) => j._id.toString() === interaction.jobId.toString()
					);
				}

				// Fetch sender's profile for avatar
				const senderProfile = await Profile.findOne({
					userId: interaction.senderId._id,
				}).lean();
				const senderAvatarURL =
					senderProfile && senderProfile.avatar
						? `${req.protocol}://${req.get('host')}/profile/${
								interaction.senderId._id
						  }/avatar`
						: '/default-avatar.png'; // Default avatar if not found

				// Fetch recipient's profile for avatar
				const recipientProfile = await Profile.findOne({
					userId: interaction.recipientId._id,
				}).lean();
				const recipientAvatarURL =
					recipientProfile && recipientProfile.avatar
						? `${req.protocol}://${req.get('host')}/profile/${
								interaction.recipientId._id
						  }/avatar`
						: '/default-avatar.png'; // Default avatar if not found

				// Format sender and recipient with avatar URLs
				const sender = interaction.senderId
					? {
							id: interaction.senderId._id.toString(),
							username: interaction.senderId.username,
							email: interaction.senderId.email,
							avatarURL: senderAvatarURL,
					  }
					: null;

				const recipient = interaction.recipientId
					? {
							id: interaction.recipientId._id.toString(),
							username: interaction.recipientId.username,
							email: interaction.recipientId.email,
							avatarURL: recipientAvatarURL,
					  }
					: null;

				// Return formatted interaction
				return {
					id: interaction._id.toString(),
					job: job
						? {
								id: job._id.toString(),
								position: job.position,
								company: job.company,
								description: job.description,
						  }
						: null,
					sender,
					recipient,
					message: interaction.message,
					timestamp: interaction.timestamp,
					status: interaction.status,
				};
			})
		);

		// Return the formatted interactions
		res.status(200).json({ interactions: formattedInteractions });
	} catch (error) {
		console.error('Error in getInteractions:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getCV = async (req, res) => {
	try {
		const { userId } = req.params;
		const profile = await Profile.findOne({ userId }).select('cv');

		if (!profile || !profile.cv) {
			return res.status(404).json({ message: 'CV not found' });
		}

		res.set('Content-Type', profile.cv.contentType);
		res.send(profile.cv.data);
	} catch (error) {
		console.error('Error in getCV:', error);
		return res
			.status(500)
			.json({ message: 'Server error', error: error.message });
	}
};
