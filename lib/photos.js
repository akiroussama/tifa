import sharp from 'sharp';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_BODY_BYTES = 4_250_000;

export class PhotoError extends Error {
  constructor(status, message, code = 'INVALID_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function fail(status, message, code) {
  throw new PhotoError(status, message, code);
}

export async function prepareImage(dataURL) {
  if (typeof dataURL !== 'string' || dataURL.length > MAX_BODY_BYTES) {
    fail(413, 'La photo est trop volumineuse. Maximum : 3 Mo.');
  }
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataURL);
  if (!match) fail(400, 'Utilisez une photo JPEG, PNG ou WebP.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    fail(413, 'La photo est trop volumineuse. Maximum : 3 Mo.');
  }
  try {
    const image = sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'warning', animated: false });
    const metadata = await image.metadata();
    const claimedFormat = match[1] === 'jpeg' ? 'jpeg' : match[1];
    if (metadata.format !== claimedFormat || !metadata.width || !metadata.height ||
        (metadata.pages || 1) > 1) {
      fail(400, 'Le fichier ne correspond pas à une photographie prise en charge.');
    }
    // Re-encode on the server: no source metadata, scripts, or original filename is published.
    const { data, info } = await image.rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#fffdf8' })
      .jpeg({ quality: 84, progressive: true })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    fail(400, 'Cette photo est illisible ou dépasse 40 mégapixels. Choisissez une autre image.');
  }
}
