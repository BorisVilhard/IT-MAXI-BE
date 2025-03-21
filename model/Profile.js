import mongoose from 'mongoose';

const authorSchema = new mongoose.Schema({
	username: { type: String, required: true },
	avatarUrl: { type: String },
});

const jobDescriptionSchema = new mongoose.Schema({
	position: { type: String, required: true },
	wageRange: { type: String, required: true },
	location: { type: String, required: true },
	experienceLevel: {
		type: String,
		enum: ['Junior', 'Medior', 'Senior'],
		required: true,
	},
	remoteOption: {
		type: String,
		enum: ['Remote', 'Hybrid', 'On-site'],
		required: true,
	},
	description: { type: String },
	jobDescription: { type: String },
	datePosted: { type: Date, default: Date.now },
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	author: authorSchema,
	postActivity: { type: Boolean, default: false },
	roleType: {
		// Added roleType field
		type: String,
		enum: ['regular', 'company'],
		required: true,
		default: 'regular',
	},
});

const courseSchema = new mongoose.Schema(
	{
		videoSrc: { type: String, default: '' },
		title: { type: String, required: true },
		description: { type: String, default: '' },
		linkToVideo: { type: String, default: '' },
		tags: [{ type: String }],
		thumbnail: {
			data: { type: Buffer },
			contentType: { type: String },
		},
		price: {
			amount: { type: Number, required: true },
			currency: { type: String, enum: ['EUR', 'USD', 'GBP'], default: 'EUR' },
		},
		websiteLink: { type: String, default: '' },
		author: authorSchema,
	},
	{ timestamps: true }
);

const carouselCardSchema = new mongoose.Schema({
	category: { type: String, default: '' },
	title: { type: String, default: '' },
	content: { type: String, default: '' },
	image: {
		data: { type: Buffer },
		contentType: { type: String },
	},
});

const profileSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		author: [authorSchema],
		avatar: {
			data: { type: Buffer },
			contentType: { type: String },
		},
		background: {
			data: { type: Buffer },
			contentType: { type: String },
		},
		tagline: { type: String, default: '' },
		industry: { type: String, default: '' },
		location: { type: String, default: '' },
		size: { type: String, default: '' },
		bio: { type: String, default: '' },
		carousel: [carouselCardSchema],
		phone: { type: String, default: '' },
		email: { type: String, default: '' },
		website: { type: String, default: '' },
		github: { type: String, default: '' },
		cv: {
			data: { type: Buffer },
			contentType: { type: String },
			fileName: { type: String },
		},
		courses: [courseSchema],
		activeRole: {
			type: String,
			enum: ['regular', 'course_creator', 'company'],
			default: 'regular',
		},
		publishedRoles: {
			regular: { type: Boolean, default: false },
			course_creator: { type: Boolean, default: false },
			company: { type: Boolean, default: false },
		},
		jobDescriptions: [jobDescriptionSchema],
		jobPostVisibility: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

export default mongoose.model('Profile', profileSchema);
