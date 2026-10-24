import { validateImage } from "@/lib/files";

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
      "photo.wrongType": "Faqat JPG, PNG yoki WebP rasm yuklash mumkin.",
      "photo.tooLarge": "Rasm hajmi 5 MB dan oshmasligi kerak.",
      "file.empty": "Rasm fayli bo‘sh.",
    };

    return {
      valid: false,
      error: messages[basicError] ?? "Rasm fayli noto‘g‘ri.",
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
        error: "Rasm kamida 640×480 piksel bo‘lishi kerak.",
        width,
        height,
      };
    }

    if (width * height > 25_000_000) {
      return {
        valid: false,
        error: "Rasmning piksel o‘lchami juda katta.",
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
      error: "Rasmni ochib bo‘lmadi. Boshqa rasm tanlang.",
    };
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
