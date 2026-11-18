
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';

import { RedisService } from '../../redis/redis.service';
import { DailyAttendanceService } from '../daily-attendance/daily-attendance.service';

const DIRTY_KEY = 'edav:push:rebuild-dirty';
const DEBOUNCE_MS = 10_000;
const RETRY_MS = 30_000;
const LOCK_SECONDS = 180;
const BATCH_SIZE = 30;
const MAX_PARALLEL = 4;

const RELEASE_LOCK = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

const REMOVE_IF_UNCHANGED = `
  local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
  if score == ARGV[2] then
    return redis.call('ZREM', KEYS[1], ARGV[1])
  end
  return 0
`;

const RETRY_IF_UNCHANGED = `
  local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
  if score == ARGV[2] then
    return redis.call(
      'ZADD', KEYS[1], ARGV[3], ARGV[1]
    )
  end
  return 0
`;

@Injectable()
export class HikvisionPushRebuildService {
    private readonly logger = new Logger(
        HikvisionPushRebuildService.name,
    );

    private running = false;

    constructor(
        private readonly redisService: RedisService,
        private readonly dailyAttendance: DailyAttendanceService,
    ) { }

    async schedule(
        schoolId: number,
        eventAt: Date,
    ): Promise<void> {
        if (
            !Number.isSafeInteger(schoolId) ||
            schoolId <= 0 ||
            !Number.isFinite(eventAt.getTime())
        ) {
            throw new Error('Rebuild parametrlari noto‘g‘ri');
        }

        // O‘zbekiston UTC+05:00 vaqt zonasidagi sana.
        const date = new Date(
            eventAt.getTime() + 5 * 60 * 60 * 1000,
        ).toISOString().slice(0, 10);

        const member = `${schoolId}:${date}`;
        const dueAt = Date.now() + DEBOUNCE_MS;

        const redis = this.redisService.getClient();

        // Bir maktab va sana uchun bitta ZSET elementi.
        // Yangi event kelganda hisoblash muddati suriladi.
        await redis.zadd(DIRTY_KEY, dueAt, member);
    }

    @Interval(5000)
    async processPending(): Promise<void> {
        if (this.running) {
            return;
        }

        this.running = true;

        try {
            const redis = this.redisService.getClient();

            const members = await redis.zrangebyscore(
                DIRTY_KEY,
                '-inf',
                Date.now(),
                'LIMIT',
                0,
                BATCH_SIZE,
            );

            for (
                let i = 0;
                i < members.length;
                i += MAX_PARALLEL
            ) {
                await Promise.all(
                    members
                        .slice(i, i + MAX_PARALLEL)
                        .map((member) => this.rebuildOne(member)),
                );
            }
        } catch (error: unknown) {
            this.logger.error(
                `Rebuild navbati xatosi: ${error instanceof Error ? error.message : 'unknown'
                }`,
            );
        } finally {
            this.running = false;
        }
    }

    private async rebuildOne(member: string): Promise<void> {
        const match = /^([1-9]\d*):(\d{4}-\d{2}-\d{2})$/.exec(
            member,
        );

        if (!match) {
            this.logger.error('Rebuild kaliti noto‘g‘ri');
            return;
        }

        const schoolId = Number(match[1]);
        const date = match[2];

        if (!Number.isSafeInteger(schoolId)) {
            return;
        }

        const redis = this.redisService.getClient();

        const lockKey = `edav:push:rebuild-lock:${member}`;
        const token = randomUUID();

        const acquired = await redis.set(
            lockKey,
            token,
            'EX',
            LOCK_SECONDS,
            'NX',
        );

        if (acquired !== 'OK') {
            return;
        }

        try {
            const score = await redis.zscore(DIRTY_KEY, member);

            if (score === null) {
                return;
            }

            if (Number(score) > Date.now()) {
                return;
            }

            try {
                await this.dailyAttendance.rebuild({
                    schoolId,
                    date,
                });

                // Hisoblash vaqtida yana event kelgan bo‘lsa,
                // yangi ZSET score o‘zgargan bo‘ladi.
                // Bunday holatda element o‘chirilmaydi.
                await redis.eval(
                    REMOVE_IF_UNCHANGED,
                    1,
                    DIRTY_KEY,
                    member,
                    score,
                );

                this.logger.log(
                    `Davomat yangilandi: maktab=${schoolId}, sana=${date}`,
                );
            } catch (error: unknown) {
                await redis.eval(
                    RETRY_IF_UNCHANGED,
                    1,
                    DIRTY_KEY,
                    member,
                    score,
                    String(Date.now() + RETRY_MS),
                );

                this.logger.error(
                    `Rebuild xatosi: maktab=${schoolId}, sana=${date}: ${error instanceof Error ? error.message : 'unknown'
                    }`,
                );
            }
        } finally {
            try {
                await redis.eval(
                    RELEASE_LOCK,
                    1,
                    lockKey,
                    token,
                );
            } catch {
                this.logger.warn(
                    `Rebuild lock bo‘shatilmadi: ${member}`,
                );
            }
        }
    }
}
