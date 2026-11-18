
import { parsePush } from './hikvision-push.parser';

describe('Hikvision HTTP Push Parser', () => {
    const event = {
        EventNotificationAlert: {
            eventType: 'AccessControllerEvent',
            dateTime: '2026-11-18T11:41:23+05:00',
            AccessControllerEvent: {
                majorEventType: 5,
                subEventType: 75,
                serialNo: 406132,
                employeeNoString: '12345678901234',
                currentVerifyMode: 'face',
            },
        },
    };

    it('JSON yuz identifikatsiyasi eventini ajratadi', () => {
        const result = parsePush(
            'application/json',
            Buffer.from(JSON.stringify(event)),
        );

        expect(result).not.toBeNull();
        expect(result?.eventType).toBe('AccessControllerEvent');
        expect(result?.major).toBe(5);
        expect(result?.minor).toBe(75);
        expect(result?.serialNo).toBe('406132');
        expect(result?.pnfl).toBe('12345678901234');
        expect(result?.verifyMode).toBe('face');
    });

    it('multipart JSON eventini ajratadi', () => {
        const boundary = 'MIME_boundary';

        const body = Buffer.from(
            `--${boundary}\r\n` +
            'Content-Disposition: form-data; name="event"\r\n' +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(event) +
            `\r\n--${boundary}--\r\n`,
        );

        const result = parsePush(
            `multipart/form-data; boundary=${boundary}`,
            body,
        );

        expect(result?.major).toBe(5);
        expect(result?.minor).toBe(75);
        expect(result?.pnfl).toBe('12345678901234');
    });

    it('XML eventini ajratadi', () => {
        const xml = `
      <EventNotificationAlert>
        <eventType>AccessControllerEvent</eventType>
        <dateTime>2026-11-18T11:41:23+05:00</dateTime>
        <AccessControllerEvent>
          <majorEventType>5</majorEventType>
          <subEventType>75</subEventType>
          <serialNo>406132</serialNo>
          <employeeNoString>12345678901234</employeeNoString>
          <currentVerifyMode>face</currentVerifyMode>
        </AccessControllerEvent>
      </EventNotificationAlert>
    `;

        const result = parsePush(
            'application/xml',
            Buffer.from(xml),
        );

        expect(result?.major).toBe(5);
        expect(result?.minor).toBe(75);
        expect(result?.verifyMode).toBe('face');
    });

    it('boshqa access-control eventini ajratadi', () => {
        const other = structuredClone(event);

        other.EventNotificationAlert.AccessControllerEvent.subEventType = 22;

        const result = parsePush(
            'application/json',
            Buffer.from(JSON.stringify(other)),
        );

        expect(result?.minor).toBe(22);
    });

    it('noto‘g‘ri JSON uchun null qaytaradi', () => {
        const result = parsePush(
            'application/json',
            Buffer.from('{invalid json'),
        );

        expect(result).toBeNull();
    });
});
