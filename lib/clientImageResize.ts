const MAX_UPLOAD_IMAGE_WIDTH = 1200;
const UPLOAD_IMAGE_QUALITY = 0.75;

const getTargetImageSize = (
  width: number,
  height: number,
  maxWidth = MAX_UPLOAD_IMAGE_WIDTH
) => {
  if (width <= maxWidth) {
    return { width, height };
  }

  const ratio = maxWidth / width;

  return {
    width: maxWidth,
    height: Math.max(1, Math.round(height * ratio)),
  };
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

export const resizeImageForUpload = async (file: File) => {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const targetSize = getTargetImageSize(bitmap.width, bitmap.height);

    if (
      targetSize.width === bitmap.width &&
      targetSize.height === bitmap.height &&
      file.type === "image/jpeg"
    ) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;

    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, targetSize.width, targetSize.height);
    bitmap.close();

    const outputType = file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = await canvasToBlob(canvas, outputType, UPLOAD_IMAGE_QUALITY);

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const extension = outputType === "image/webp" ? "webp" : "jpg";
    const resizedName =
      file.name.replace(/\.[^.]+$/, `.${extension}`) ||
      `listing-image.${extension}`;

    return new File([blob], resizedName, {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
};
