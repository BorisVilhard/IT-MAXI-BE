// utils/imageProcessor.js
import sharp from 'sharp';

export async function processImage(buffer) {
	try {
		const image = await sharp(buffer)
			.resize({
				width: 1920,
				height: 1920,
				fit: 'inside',
				withoutEnlargement: true,
			})
			.jpeg({ quality: 80 })
			.toBuffer();

		return image;
	} catch (error) {
		throw new Error('Image processing failed: ' + error.message);
	}
}
