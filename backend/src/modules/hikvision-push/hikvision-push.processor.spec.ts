
jest.mock('@nestjs/bullmq', () => ({
    Processor: () => () => undefined,
    WorkerHost: class MockWorkerHost { },
}));

import { HikvisionPushProcessor } from './hikvision-push.processor';
import { HikvisionPushRebuildService } from './hikvision-push-rebuild.service';
import { HIKVISION_PUSH_JOB } from './hikvision-push.types';
import type { PushJob } from './hikvision-push.types';
import type { Job } from 'bullmq';
import type { Repository } from 'typeorm';
import { Terminal } from '../terminals/terminal.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';

describe('HikvisionPushProcessor', () => {
    const rebuildService = {
        schedule: jest.fn().mockResolvedValue(undefined),
    };

    const execute = jest.fn().mockResolvedValue({
        raw: { affectedRows: 1 },
    });

    const orIgnore = jest.fn().mockReturnValue({ execute });
    const values = jest.fn().mockReturnValue({ orIgnore });
    const into = jest.fn().mockReturnValue({ values });
    const insert = jest.fn().mockReturnValue({ into });

    const terminals = {
        findOneBy: jest.fn(),
    };

    const events = {
        createQueryBuilder: jest.fn().mockReturnValue({ insert }),
    };

    let processor: HikvisionPushProcessor;

    beforeEach(() => {
        jest.clearAllMocks();

        execute.mockResolvedValue({
            raw: { affectedRows: 1 },
        });

        rebuildService.schedule.mockResolvedValue(undefined);

        terminals.findOneBy.mockResolvedValue({
            id: 1,
            schoolId: 17,
            isActive: true,
            archivedAt: null,
            direction: 'IN',
        });

        processor = new HikvisionPushProcessor(
            terminals as unknown as Repository<Terminal>,
            events as unknown as Repository<AttendanceEvent>,
            rebuildService as unknown as HikvisionPushRebuildService,
        );
    });

    function makeJob(
        minor: number,
        verifyMode = 'face',
    ): Job<PushJob> {
        const payload = {
            EventNotificationAlert: {
                eventType: 'AccessControllerEvent',
                dateTime: '2026-11-18T11:41:23+05:00',
                AccessControllerEvent: {
                    majorEventType: 5,
                    subEventType: minor,
                    serialNo: 406132,
                    employeeNoString: '12345678901234',
                    currentVerifyMode: verifyMode,
                },
            },
        };

        return {
            name: HIKVISION_PUSH_JOB,
            data: {
                terminalId: 1,
                sourceIp: '10.10.11.166',
                contentType: 'application/json',
                bodyBase64: Buffer.from(
                    JSON.stringify(payload),
                ).toString('base64'),
                receivedAt: new Date().toISOString(),
            },
        } as Job<PushJob>;
    }

    it('yuz eventini MySQL insertga uzatadi va rebuild belgilaydi', async () => {
        await processor.process(makeJob(75));

        expect(values).toHaveBeenCalledWith(
            expect.objectContaining({
                terminalId: 1,
                schoolId: 17,
                pnfl: '12345678901234',
                serialNo: '406132',
                verifyMode: 'face',
            }),
        );

        expect(orIgnore).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledTimes(1);

        expect(rebuildService.schedule).toHaveBeenCalledWith(
            17,
            new Date('2026-11-18T11:41:23+05:00'),
        );
    });

    it('boshqa access-control eventini saqlamaydi', async () => {
        await processor.process(makeJob(22));

        expect(events.createQueryBuilder).not.toHaveBeenCalled();
        expect(rebuildService.schedule).not.toHaveBeenCalled();
    });

    it('face bo‘lmagan verification eventini saqlamaydi', async () => {
        await processor.process(makeJob(75, 'card'));

        expect(events.createQueryBuilder).not.toHaveBeenCalled();
        expect(rebuildService.schedule).not.toHaveBeenCalled();
    });

    it('takroriy event uchun ham rebuild belgisini tiklaydi', async () => {
        execute.mockResolvedValue({
            raw: { affectedRows: 0 },
        });

        await processor.process(makeJob(75));

        expect(execute).toHaveBeenCalledTimes(1);
        expect(rebuildService.schedule).toHaveBeenCalledTimes(1);
    });

    it('Redis rebuild belgilashda xato bo‘lsa, xatoni yuqoriga uzatadi', async () => {
        rebuildService.schedule.mockRejectedValueOnce(
            new Error('Redis unavailable'),
        );

        await expect(processor.process(makeJob(75)))
            .rejects.toThrow('Redis unavailable');
    });
});
