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
		// Fields added for the forgot-password flow
		resetCode: { type: String, default: null },
		resetCodeExpiration: { type: Number, default: null },
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
