import Profile from '../model/Profile.js';
import Interaction from '../model/Interaction.js';
import { processImage } from '../utils/imageProcessor.js';
import mongoose from 'mongoose';

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

		const profileDataJson = req.body.profileData
			? JSON.parse(req.body.profileData)
			: {};
		const { carousel, courses, jobDescriptions } = req.body;

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
		const cvFile = req.files?.cv ? req.files.cv[0] : null;

		const existingProfile = await Profile.findOne({ userId });
		const user = await mongoose.model('User').findById(userId);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		const setData = {};
		const unsetData = {};

		for (const [key, value] of Object.entries(profileDataJson)) {
			if (value === null) {
				unsetData[key] = '';
			} else if (value !== undefined) {
				setData[key] = value;
			}
		}

		let newAvatarUrl = null;

		if (avatarFile) {
			const processedAvatar = await processImage(avatarFile.buffer);
			if (!processedAvatar) throw new Error('Failed to process avatar');
			setData.avatar = {
				data: processedAvatar,
				contentType: avatarFile.mimetype,
			};
			imageCache.delete(`avatar:${userId}`);
			newAvatarUrl = `${req.protocol}://${req.get(
				'host'
			)}/profile/${userId}/avatar?v=${Date.now()}`;
			setData['author.0.avatarUrl'] = newAvatarUrl;

			if (
				existingProfile &&
				existingProfile.courses &&
				existingProfile.courses.length > 0
			) {
				setData.courses = existingProfile.courses.map((course) => {
					const courseObj = course.toObject ? course.toObject() : course;
					return {
						...courseObj,
						author: { ...courseObj.author, avatarUrl: newAvatarUrl },
					};
				});
			}

			if (
				existingProfile &&
				existingProfile.jobDescriptions &&
				existingProfile.jobDescriptions.length > 0
			) {
				setData.jobDescriptions = existingProfile.jobDescriptions.map((job) => {
					const jobObj = job.toObject ? job.toObject() : job;
					return {
						...jobObj,
						author: { ...jobObj.author, avatarUrl: newAvatarUrl },
					};
				});
			}
		} else if (profileDataJson.removeAvatar === true) {
			unsetData.avatar = '';
			imageCache.delete(`avatar:${userId}`);
		}

		if (backgroundFile) {
			const processedBg = await processImage(backgroundFile.buffer);
			if (!processedBg) throw new Error('Failed to process background');
			setData.background = {
				data: processedBg,
				contentType: backgroundFile.mimetype,
			};
			imageCache.delete(`background:${userId}`);
		} else if (profileDataJson.removeBackground === true) {
			unsetData.background = '';
			imageCache.delete(`background:${userId}`);
		}

		if (cvFile) {
			setData.cv = {
				data: cvFile.buffer,
				contentType: cvFile.mimetype,
				fileName: cvFile.originalname,
			};
		} else if (profileDataJson.cvUrl === null) {
			unsetData.cv = '';
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
				newItem.image = {
					data: processedImage,
					contentType: carouselFiles[carouselFileIndex].mimetype,
				};
				carouselFileIndex++;
			}
			processedCarousel.push(newItem);
		}
		setData.carousel = processedCarousel;

		if (courses !== undefined) {
			const coursesData = JSON.parse(courses);
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
						id: userId.toString(),
						username: course.author?.username || user.username || 'Unknown',
						avatarUrl:
							course.author?.avatarUrl ||
							(existingProfile?.avatar
								? `${req.protocol}://${req.get(
										'host'
								  )}/profile/${userId}/avatar`
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
					newCourse.thumbnail = {
						data: processedThumbnail,
						contentType: courseThumbnailFiles[courseFileIndex].mimetype,
					};
					courseFileIndex++;
				}
				processedCourses.push(newCourse);
			}
			setData.courses = processedCourses;
			// Only set course_creator to true if not explicitly provided in publishedRoles
			if (
				!profileDataJson.publishedRoles ||
				profileDataJson.publishedRoles.course_creator === undefined
			) {
				setData.publishedRoles = {
					...existingProfile?.publishedRoles,
					course_creator: true,
				};
			} else {
				setData.publishedRoles = profileDataJson.publishedRoles;
			}
		} else if (profileDataJson.publishedRoles) {
			setData.publishedRoles = profileDataJson.publishedRoles; // Respect frontend-provided publishedRoles
		}

		const jobDescriptionsData = jobDescriptions
			? JSON.parse(jobDescriptions)
			: [];
		setData.jobDescriptions = existingProfile?.jobDescriptions || [];
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
					job.roleType || (existingJob ? existingJob.roleType : 'regular'),
			};
			if (existingJob) {
				const index = setData.jobDescriptions.findIndex(
					(j) => j._id.toString() === job._id
				);
				setData.jobDescriptions[index] = jobData;
			} else {
				setData.jobDescriptions.push(jobData);
			}
		}
		if (
			newAvatarUrl &&
			setData.jobDescriptions &&
			setData.jobDescriptions.length > 0
		) {
			setData.jobDescriptions = setData.jobDescriptions.map((job) => ({
				...job,
				author: { ...job.author, avatarUrl: newAvatarUrl },
			}));
		}

		const updateQuery = {};
		if (Object.keys(setData).length > 0) updateQuery.$set = setData;
		if (Object.keys(unsetData).length > 0) updateQuery.$unset = unsetData;

		let updatedProfile;
		if (existingProfile) {
			updatedProfile = await Profile.findOneAndUpdate({ userId }, updateQuery, {
				new: true,
				runValidators: true,
			});
		} else {
			updatedProfile = await new Profile({ userId, ...setData }).save();
		}

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
			cvUrl: updatedProfile.cv ? `${baseUrl}/${userId}/cv` : null,
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
					id: course.author?.id || userId.toString(),
					username: course.author?.username || 'Unknown',
					avatarUrl: course.author?.avatarUrl || null,
				},
			})),
			jobDescriptions: updatedProfile.jobDescriptions.map((job) => ({
				...job.toObject(),
				author: {
					id: job.author?.id || userId,
					username: job.author?.username || 'Unknown',
					avatarUrl: job.author?.avatarUrl || null,
				},
			})),
			publishedRoles: updatedProfile.publishedRoles,
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
		// Extract userId from request parameters
		const { userId } = req.params;

		// Fetch the profile from the database, populate username, and exclude binary data
		const profile = await Profile.findOne({ userId })
			.populate('userId', 'username') // Populate username from the User model
			.select(
				'-cv.data -avatar.data -background.data -carousel.image.data -courses.thumbnail.data'
			);

		// Check if profile exists
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}

		// Construct base URL for media files using request protocol and host
		const baseUrl = `${req.protocol}://${req.get('host')}/profile`;
		const timestamp = profile.updatedAt.getTime(); // Cache-busting timestamp

		// Build the profileData object with all necessary fields
		const profileData = {
			...profile.toObject(), // Convert Mongoose document to plain object
			username: profile.userId.username, // Add populated username
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
					id: course.author?.id || userId, // Include author ID, default to userId
					username: course.author?.username || 'Unknown',
					avatarUrl: course.author?.avatarUrl || null,
				},
			})),
			jobDescriptions: profile.jobDescriptions.map((job) => ({
				...job.toObject(),
				author: {
					id: job.author?.id || userId, // Include author ID, default to userId
					username: job.author?.username || 'Unknown',
					avatarUrl: job.author?.avatarUrl || null,
				},
			})),
		};

		// Send successful response with profile data
		res.status(200).json(profileData);
	} catch (error) {
		// Log error and send a 500 response with error details
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
			[`publishedRoles.${roleType}`]: true, // Filters profiles where the role is published
		})
			.populate('userId', 'username')
			.lean();

		const jobDescriptions = profiles.flatMap((profile) => {
			const userId =
				profile.userId && typeof profile.userId === 'object'
					? profile.userId._id.toString()
					: profile.userId.toString();

			const computedAvatarUrl = profile.avatar
				? `${req.protocol}://${req.get(
						'host'
				  )}/profile/${userId}/avatar?v=${profile.updatedAt.getTime()}`
				: '/default-logo.png';

			return profile.jobDescriptions
				.filter((job) => job.roleType === roleType)
				.map((job) => ({
					...job,
					username: profile.userId?.username || 'Unknown',
					author: {
						username: job.author?.username || 'Unknown',
						avatarUrl: computedAvatarUrl,
					},
					profileActiveRole: profile.activeRole,
				}));
		});

		const total = jobDescriptions.length;
		const paginatedJobs = jobDescriptions.slice(skip, skip + limit);

		return res.status(200).json({
			jobs: paginatedJobs,
			total,
			currentPage: page,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		console.error('Error in getJobsByRoleType:', error);
		return res
			.status(500)
			.json({ message: 'Server error', error: error.message });
	}
};

export const getAllCourses = async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;
		const profiles = await Profile.find({ 'courses.0': { $exists: true } })
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
					id: course.author?.id || profile.userId._id.toString(),
					username:
						course.author?.username || profile.userId.username || 'Unknown',
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
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getInteractions = async (req, res) => {
	try {
		if (!req.user || !req.user.id) {
			return res
				.status(401)
				.json({ message: 'Unauthorized: No user data found' });
		}
		const userId = req.user.id;

		const interactions = await Interaction.find({
			$or: [{ senderId: userId }, { recipientId: userId }],
		})
			.populate('senderId', 'username email')
			.populate('recipientId', 'username email')
			.lean();

		if (!interactions || interactions.length === 0) {
			return res.status(200).json({ interactions: [] });
		}

		const formattedInteractions = await Promise.all(
			interactions.map(async (interaction) => {
				let post = null;
				// First try to find the post in jobDescriptions
				const jobProfile = await Profile.findOne({
					'jobDescriptions._id': interaction.jobId,
				}).lean();
				if (jobProfile) {
					post = jobProfile.jobDescriptions.find(
						(j) => j._id.toString() === interaction.jobId.toString()
					);
				} else {
					// If not found, try to find it in courses
					const courseProfile = await Profile.findOne({
						'courses._id': interaction.jobId,
					}).lean();
					if (courseProfile) {
						post = courseProfile.courses.find(
							(c) => c._id.toString() === interaction.jobId.toString()
						);
					}
				}

				// Fetch sender's profile to get avatar and extra data
				const senderProfile = await Profile.findOne({
					userId: interaction.senderId._id,
				}).lean();
				const senderAvatarURL =
					senderProfile && senderProfile.avatar
						? `${req.protocol}://${req.get('host')}/profile/${
								interaction.senderId._id
						  }/avatar`
						: '/default-avatar.png';
				const senderAdditional = senderProfile
					? {
							phone: senderProfile.phone || '',
							email: senderProfile.email || '',
							website: senderProfile.website || '',
							github: senderProfile.github || '',
							cvUrl: senderProfile.cv
								? `${req.protocol}://${req.get('host')}/profile/${
										interaction.senderId._id
								  }/cv`
								: '',
					  }
					: {};

				// Fetch recipient's profile for avatar
				const recipientProfile = await Profile.findOne({
					userId: interaction.recipientId._id,
				}).lean();
				const recipientAvatarURL =
					recipientProfile && recipientProfile.avatar
						? `${req.protocol}://${req.get('host')}/profile/${
								interaction.recipientId._id
						  }/avatar`
						: '/default-avatar.png';

				// Format the post object.
				// For job posts, use job.position; for courses, use course.title.
				const postData = post
					? {
							id: post._id.toString(),
							// If "position" exists, it’s a job post; otherwise, use "title" from a course.
							position: post.position ? post.position : post.title,
							company: post.company || '',
							description: post.description || '',
					  }
					: null;

				return {
					id: interaction._id.toString(),
					job: postData,
					sender: {
						id: interaction.senderId._id.toString(),
						username: interaction.senderId.username,
						email: interaction.senderId.email,
						avatarURL: senderAvatarURL,
						senderRole: interaction.senderRole,
						...senderAdditional,
					},
					recipient: {
						id: interaction.recipientId._id.toString(),
						username: interaction.recipientId.username,
						email: interaction.recipientId.email,
						avatarURL: recipientAvatarURL,
					},
					message: interaction.message,
					timestamp: interaction.timestamp,
					status: interaction.status,
					isFavorite: interaction.isFavorite,
				};
			})
		);

		return res.status(200).json({ interactions: formattedInteractions });
	} catch (error) {
		console.error('Error in getInteractions:', error);
		return res
			.status(500)
			.json({ message: 'Server error', error: error.message });
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

export const createJobDescription = async (req, res) => {
	try {
		const userId = req.user.id;
		const jobData = req.body;

		const profile = await Profile.findOne({ userId });
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}

		const newJob = {
			...jobData,
			userId,
			datePosted: new Date(),
			author: {
				username: req.user.username || 'Unknown',
				avatarUrl: profile.avatar
					? `${req.protocol}://${req.get('host')}/profile/${userId}/avatar`
					: null,
			},
		};

		if (newJob.roleType === 'regular') {
			profile.publishedRoles.regular = true;
		} else if (newJob.roleType === 'company') {
			profile.publishedRoles.company = true;
		}

		profile.jobDescriptions.push(newJob);
		await profile.save();

		const savedJob =
			profile.jobDescriptions[profile.jobDescriptions.length - 1];
		res.status(201).json({ message: 'Job created', job: savedJob });
	} catch (error) {
		console.error('Error in createJobDescription:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const updateJobDescription = async (req, res) => {
	try {
		const userId = req.user.id;
		const { jobId } = req.params;
		const jobData = req.body;

		const profile = await Profile.findOne({ userId });
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}

		const jobIndex = profile.jobDescriptions.findIndex(
			(j) => j._id.toString() === jobId
		);
		if (jobIndex === -1) {
			return res.status(404).json({ message: 'Job not found' });
		}

		profile.jobDescriptions[jobIndex] = {
			...profile.jobDescriptions[jobIndex].toObject(),
			...jobData,
		};
		await profile.save();

		res.status(200).json({
			message: 'Job updated',
			job: profile.jobDescriptions[jobIndex],
		});
	} catch (error) {
		console.error('Error in updateJobDescription:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const deleteJobDescription = async (req, res) => {
	try {
		const userId = req.user.id;
		const { jobId } = req.params;

		const profile = await Profile.findOne({ userId });
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}

		const jobIndex = profile.jobDescriptions.findIndex(
			(j) => j._id.toString() === jobId
		);
		if (jobIndex === -1) {
			return res.status(404).json({ message: 'Job not found' });
		}

		profile.jobDescriptions.splice(jobIndex, 1);
		await profile.save();

		res.status(200).json({ message: 'Job deleted' });
	} catch (error) {
		console.error('Error in deleteJobDescription:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const getCourseById = async (req, res) => {
	try {
		const { courseId } = req.params; // Extract courseId from the URL
		// Find a profile containing a course with the given ID
		const profile = await Profile.findOne({ 'courses._id': courseId }).lean();

		if (!profile) {
			return res.status(404).json({ message: 'Course not found' });
		}

		// Find the specific course within the profile's courses array
		const course = profile.courses.find((c) => c._id.toString() === courseId);
		if (!course) {
			return res.status(404).json({ message: 'Course not found' });
		}

		// Construct the response, mirroring the structure of getAllCourses
		const baseUrl = `${req.protocol}://${req.get('host')}/profile`;
		const timestamp = profile.updatedAt.getTime();
		const courseData = {
			_id: course._id.toString(),
			title: course.title,
			description: course.description || '',
			linkToVideo: course.linkToVideo || '',
			tags: course.tags || [],
			thumbnailUrl: course.thumbnail
				? `${baseUrl}/${profile.userId}/courses/${course._id}/thumbnail?v=${timestamp}`
				: null,
			price: {
				amount: course.price.amount,
				currency: course.price.currency,
			},
			websiteLink: course.websiteLink || '',
			author: {
				id: course.author?.id || profile.userId.toString(),
				username: course.author?.username || 'Unknown',
				avatarUrl:
					course.author?.avatarUrl ||
					(profile.avatar
						? `${baseUrl}/${profile.userId}/avatar?v=${timestamp}`
						: null),
			},
			createdAt: course.createdAt,
			updatedAt: course.updatedAt,
		};

		res.status(200).json(courseData);
	} catch (error) {
		console.error('Error in getCourseById:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const updateInteraction = async (req, res) => {
	try {
		const { interactionId } = req.params;
		const { status, isFavorite } = req.body;
		const userId = req.user.id;

		const updateData = {};
		if (status) updateData.status = status;
		if (typeof isFavorite === 'boolean') updateData.isFavorite = isFavorite;

		// Update the interaction and return the result as a plain object
		const updatedInteraction = await Interaction.findOneAndUpdate(
			{ _id: interactionId, recipientId: userId }, // Ensure the user is authorized
			{ $set: updateData }, // Update only specified fields
			{ new: true } // Return the updated document
		).lean(); // Avoid Mongoose validation

		// Check if the interaction exists and the user is authorized
		if (!updatedInteraction) {
			return res
				.status(404)
				.json({ message: 'Interaction not found or not authorized' });
		}

		// Send the successful response
		res.status(200).json({
			message: 'Interaction updated',
			interaction: updatedInteraction,
		});
	} catch (error) {
		console.error('Error in updateInteraction:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const deleteInteraction = async (req, res) => {
	try {
		const { interactionId } = req.params;
		const userId = req.user.id;

		const interaction = await Interaction.findById(interactionId);
		if (!interaction) {
			return res.status(404).json({ message: 'Interaction not found' });
		}
		if (interaction.recipientId.toString() !== userId) {
			return res.status(403).json({ message: 'Not authorized' });
		}

		await interaction.deleteOne();
		res.status(200).json({ message: 'Interaction deleted' });
	} catch (error) {
		console.error('Error in deleteInteraction:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

export const createInteraction = async (req, res) => {
	try {
		// Extract fields from the request body:
		const { jobId, courseId, message, senderRole } = req.body;
		const senderId = req.user.id; // Assuming user ID comes from authentication middleware

		// Check for missing required fields. Accept either jobId OR courseId.
		if ((!jobId && !courseId) || !message || !senderRole) {
			return res.status(400).json({
				message:
					'Missing required fields: jobId/courseId, message, or senderRole',
			});
		}

		// Validate senderRole
		const validRoles = ['company', 'regular', 'course_creator'];
		if (!validRoles.includes(senderRole)) {
			return res.status(400).json({ message: 'Invalid sender role' });
		}

		// Find the recipient based on the provided post id.
		let profile;
		if (jobId) {
			profile = await Profile.findOne({ 'jobDescriptions._id': jobId });
			if (!profile) {
				return res.status(404).json({ message: 'Job post not found' });
			}
		} else {
			profile = await Profile.findOne({ 'courses._id': courseId });
			if (!profile) {
				return res.status(404).json({ message: 'Course post not found' });
			}
		}

		const recipientId = profile.userId; // The user who owns the post
		const postId = jobId ? jobId : courseId;

		// Create the interaction
		const interaction = new Interaction({
			// For backward compatibility, store the id in the "jobId" field.
			jobId: postId,
			senderId,
			recipientId,
			message,
			senderRole,
		});

		await interaction.save();
		return res
			.status(201)
			.json({ message: 'Interaction created', interaction });
	} catch (error) {
		console.error('Error in createInteraction:', error);
		return res
			.status(500)
			.json({ message: 'Server error', error: error.message });
	}
};
