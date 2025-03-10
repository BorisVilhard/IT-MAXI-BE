import mongoose from 'mongoose';

// Define the schema for courses
const courseSchema = new mongoose.Schema(
	{
		videoSrc: {
			type: String,
			default: '',
		},
		title: {
			type: String,
			default: '',
		},
		description: {
			type: String,
			default: '',
		},
		linkToVideo: {
			type: String,
			default: '',
		},
	},
	{ timestamps: true }
);

const carouselCardSchema = new mongoose.Schema({
	category: { type: String, default: '' },
	title: { type: String, default: '' },
	content: { type: String, default: '' },
	image: {
		data: { type: Buffer }, // Binary image data
		contentType: { type: String }, // MIME type (e.g., 'image/jpeg')
	},
});

// Main profile schema
const profileSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
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
		carousel: [carouselCardSchema], // Array of carousel items
		phone: { type: String, default: '' },
		email: { type: String, default: '' },
		website: { type: String, default: '' },
		github: { type: String, default: '' },
		cv: { type: String, default: '' }, // Could be a URL or path; adjust if storing as binary
	},
	{ timestamps: true }
);

// Export the Profile model
export default mongoose.model('Profile', profileSchema);
