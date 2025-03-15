import mongoose from 'mongoose';

const interactionSchema = new mongoose.Schema({
	jobId: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
	},
	senderId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	recipientId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	message: { type: String, required: true },
	timestamp: { type: Date, default: Date.now },
	status: {
		type: String,
		enum: ['pending', 'accepted', 'rejected'],
		default: 'pending',
	},
});

export default mongoose.model('Interaction', interactionSchema);
