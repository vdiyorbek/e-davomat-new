import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateSchoolDto } from './update-school.dto';

const check = async (body: object) =>
  (await validate(plainToInstance(UpdateSchoolDto, body))).length === 0;

describe('Maktab lokatsiyasi tekshiruvi', () => {
  it('O‘zbekiston ichidagi koordinata qabul qilinadi (vergul ham, uzun kasr ham)', async () => {
    expect(await check({ latitude: 41.311081, longitude: 69.240562 })).toBe(
      true,
    );
    expect(
      await check({ latitude: '41,3110812345', longitude: '69.2405629' }),
    ).toBe(true);
  });

  it('chegaradan tashqari yoki son bo‘lmagan qiymat rad etiladi', async () => {
    expect(await check({ latitude: 10, longitude: 69 })).toBe(false);
    expect(await check({ latitude: 41.3, longitude: 100 })).toBe(false);
    expect(await check({ latitude: 'abc', longitude: 69 })).toBe(false);
  });

  it('bo‘sh qiymat lokatsiyani o‘chirishni bildiradi', async () => {
    const dto = plainToInstance(UpdateSchoolDto, {
      latitude: '',
      longitude: '',
    });
    expect(dto.latitude).toBeNull();
    expect(dto.longitude).toBeNull();
    expect(await check({ latitude: '', longitude: '' })).toBe(true);
  });
});
