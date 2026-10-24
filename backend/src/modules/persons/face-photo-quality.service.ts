import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface FacePhotoQualityResult {
  acceptable: boolean;
  brightness: number;
  sharpness: number;
  warnings: string[];
}

@Injectable()
export class FacePhotoQualityService {
  async check(buffer: Buffer): Promise<FacePhotoQualityResult> {
    const image = sharp(buffer, {
      limitInputPixels: 25_000_000,
      failOn: 'warning',
    });

    const { data, info } = await image
      .rotate()
      .resize(256, 256, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const pixels = width * height;

    let brightnessSum = 0;

    for (let i = 0; i < pixels; i++) {
      brightnessSum += data[i];
    }

    const brightness = brightnessSum / pixels;

    // Qo‘shni piksel gradientlari yordamida
    // tasvirning umumiy aniqligini baholaymiz.
    let gradientSum = 0;
    let gradientCount = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;

        const dx = data[index + 1] - data[index - 1];

        const dy = data[index + width] - data[index - width];

        gradientSum += Math.sqrt(dx * dx + dy * dy);
        gradientCount++;
      }
    }

    const sharpness = gradientCount > 0 ? gradientSum / gradientCount : 0;

    const warnings: string[] = [];

    if (brightness < 50) {
      warnings.push('Rasm juda qorong‘i. Yorug‘roq joyda suratga oling.');
    }

    if (brightness > 210) {
      warnings.push('Rasm haddan tashqari yorug‘.');
    }

    if (sharpness < 8) {
      warnings.push('Rasm xira bo‘lishi mumkin.');
    }

    return {
      acceptable: warnings.length === 0,
      brightness: Number(brightness.toFixed(2)),
      sharpness: Number(sharpness.toFixed(2)),
      warnings,
    };
  }
}
