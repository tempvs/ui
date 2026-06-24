export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

type PrepareImageFileOptions = {
  maxDimension?: number;
  targetBytes?: number;
  minDimension?: number;
  minQuality?: number;
  startQuality?: number;
};

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_TARGET_BYTES = 900 * 1024;
const DEFAULT_MIN_DIMENSION = 800;
const DEFAULT_MIN_QUALITY = 0.55;
const DEFAULT_START_QUALITY = 0.9;

export async function prepareImageFile(
  file: File,
  {
    maxDimension = DEFAULT_MAX_DIMENSION,
    targetBytes = DEFAULT_TARGET_BYTES,
    minDimension = DEFAULT_MIN_DIMENSION,
    minQuality = DEFAULT_MIN_QUALITY,
    startQuality = DEFAULT_START_QUALITY,
  }: PrepareImageFileOptions = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  if (file.size <= targetBytes) {
    return file;
  }

  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  let { width, height } = getScaledDimensions(image.width, image.height, maxDimension);
  let quality = startQuality;

  while (true) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const resizedFile = await canvasToJpegFile(canvas, file.name, quality);
    if (resizedFile.size <= targetBytes) {
      return resizedFile;
    }

    if (quality > minQuality) {
      quality = Math.max(quality - 0.1, minQuality);
      continue;
    }

    if (Math.max(width, height) <= minDimension) {
      return resizedFile;
    }

    width = Math.max(Math.round(width * 0.85), minDimension);
    height = Math.max(Math.round(height * 0.85), minDimension);
    quality = startQuality;
  }
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('Unable to process the selected image.'));
    };
    image.src = imageUrl;
  });
}

function getScaledDimensions(width: number, height: number, maxDimension: number) {
  if (Math.max(width, height) <= maxDimension) {
    return { width, height };
  }

  if (width >= height) {
    return {
      width: maxDimension,
      height: Math.max(Math.round((height / width) * maxDimension), 1),
    };
  }

  return {
    width: Math.max(Math.round((width / height) * maxDimension), 1),
    height: maxDimension,
  };
}

function canvasToJpegFile(canvas: HTMLCanvasElement, originalName: string, quality: number) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Unable to resize the selected image.'));
        return;
      }

      resolve(new File([blob], replaceFileExtension(originalName, 'jpg'), { type: 'image/jpeg' }));
    }, 'image/jpeg', quality);
  });
}

function replaceFileExtension(fileName: string, extension: string) {
  const normalizedName = fileName || 'image';
  const lastDotIndex = normalizedName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return `${normalizedName}.${extension}`;
  }

  return `${normalizedName.slice(0, lastDotIndex)}.${extension}`;
}
