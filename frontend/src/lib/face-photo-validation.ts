import i18n from "@/i18n";
import { validateImage } from "@/lib/files";

const MAX_SIZE_MB = 5;

export interface FacePhotoValidationResult {
  valid: boolean;
  error: string | null;
  width?: number;
  height?: number;
}

export async function validateFacePhoto(
  file: File,
): Promise<FacePhotoValidationResult> {
  const basicError = validateImage(file);

  if (basicError) {
    const messages: Record<string, string> = {
      "photo.wrongType": i18n.t("photo.wrongType"),
      "photo.tooLarge": i18n.t("photo.tooLarge", { size: MAX_SIZE_MB }),
      "file.empty": i18n.t("photo.empty"),
    };

    return {
      valid: false,
      error: messages[basicError] ?? i18n.t("photo.invalid"),
    };
  }

  let url: string | null = null;

  try {
    url = URL.createObjectURL(file);

    const image = new Image();
    image.src = url;

    await image.decode();

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);

    if (shortSide < 480 || longSide < 640) {
      return {
        valid: false,
        error: i18n.t("photo.tooSmall"),
        width,
        height,
      };
    }

    if (width * height > 25_000_000) {
      return {
        valid: false,
        error: i18n.t("photo.tooManyPixels"),
        width,
        height,
      };
    }

    return {
      valid: true,
      error: null,
      width,
      height,
    };
  } catch {
    return {
      valid: false,
      error: i18n.t("photo.openFailed"),
    };
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
