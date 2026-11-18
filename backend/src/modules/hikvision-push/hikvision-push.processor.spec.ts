jest.mock('@nestjs/bullmq', () => ({
    Processor: () => () => undefined,

    WorkerHost: class MockWorkerHost { },
}));
import { HikvisionPushProcessor } from './hikvision-push.processor';
import { HIKVISION_PUSH_JOB } from './hikvision-push.types';
import type { PushJob } from './hikvision-push.types';
import type { Job } from 'bullmq';
import type { Repository } from 'typeorm';
import { Terminal } from '../terminals/terminal.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';

describe('HikvisionPushProcessor', () => {
    const execute = jest.fn().mockResolvedValue({});
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

    it('muvaffaqiyatli yuz eventini MySQL insertga uzatadi', async () => {
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

        expect(orIgnore).toHaveBeenCalled();
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('boshqa access-control eventini saqlamaydi', async () => {
        await processor.process(makeJob(22));

        expect(events.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('face bo‘lmagan verification eventini saqlamaydi', async () => {
        await processor.process(makeJob(75, 'card'));

        expect(events.createQueryBuilder).not.toHaveBeenCalled();
    });
});
