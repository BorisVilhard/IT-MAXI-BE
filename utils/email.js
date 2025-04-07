import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const sendResetCodeEmail = async (toEmail, resetCode) => {
	const transporter = nodemailer.createTransport({
		service: 'Gmail',
		auth: {
			user: 'itjobs.official.m@gmail.com',
			pass: 'ptls lsuh swus ahrc',
		},
	});

	const mailOptions = {
		from: 'itjobs.official.m@gmail.com',
		to: toEmail,
		subject: 'Resetovaci kod od ITJOBS',
		text: `Resetovací kod: ${resetCode}. Platí len 10 minút`,
	};

	await transporter.sendMail(mailOptions);
};
