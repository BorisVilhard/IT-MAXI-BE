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
					newItem.image =
						item.src === 'new_file' && carouselFileIndex < carouselFiles.length
							? {
									data: await processImage(
										carouselFiles[carouselFileIndex].buffer
									),
									contentType: carouselFiles[carouselFileIndex].mimetype,
							  }
							: existingItem.image;
					if (item.src === 'new_file') carouselFileIndex++;
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
					if (course.thumbnail === 'new_file') courseFileIndex++;
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
		if (req.user.id !== userId && !req.user.roles.includes('admin')) {
			return res.status(403).json({ message: 'Unauthorized' });
		}
		const profile = await Profile.findOne({ userId });
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}
		const baseUrl = `${req.protocol}://${req.get('host')}/profile`;
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

export const getCourseThumbnail = async (req, res) => {
	try {
		const { userId, courseId } = req.params;
		const profile = await Profile.findOne({ userId });
		if (!profile) {
			return res.status(404).json({ message: 'Profile not found' });
		}
		const course = profile.courses.id(courseId);
		if (!course || !course.thumbnail) {
			return res.status(404).json({ message: 'Course thumbnail not found' });
		}
		res.set('Content-Type', course.thumbnail.contentType || 'image/jpeg');
		res.send(course.thumbnail.data);
	} catch (error) {
		console.error('Error in getCourseThumbnail:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

// Updated to handle separate lists for regular and company roles
export const getAllJobDescriptions = async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const roleType = req.query.roleType; // 'regular' or 'company'
		const skip = (page - 1) * limit;

		// Build query based on visibility and roleType
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
