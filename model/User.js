import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const Schema = mongoose.Schema;

const userSchema = new Schema(
	{
		username: { type: String, required: true },
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		password: { type: String },
		regNumber: { type: String },
		registeredAddress: { type: String },
		roles: { type: [String], default: ['regular'] },
		refreshToken: { type: String },
		googleDriveTokens: {
			access_token: { type: String },
			refresh_token: { type: String },
			scope: { type: String },
			token_type: { type: String },
			expiry_date: { type: Number },
		},
		resetCode: { type: String, default: null },
		resetCodeExpiration: { type: Number, default: null },
		stripeCustomerId: { type: String },
		subscription: {
			planId: { type: String },
			role: { type: String, enum: ['regular', 'company'], default: 'regular' },
			jobLimit: { type: Number, default: 1 },
			visibilityDays: { type: Number, default: 10 },
			canTop: { type: Boolean, default: false },
			topDays: { type: Number, default: 0 },
			subscriptionId: { type: String },
			activeUntil: { type: Date },
		},
	},
	{ timestamps: true }
);

userSchema.pre('save', async function (next) {
	if (this.password && this.isModified('password')) {
		if (!this.password.startsWith('$')) {
			const salt = await bcrypt.genSalt(10);
			this.password = await bcrypt.hash(this.password, salt);
		}
	}
	next();
});

export default mongoose.model('User', userSchema);
