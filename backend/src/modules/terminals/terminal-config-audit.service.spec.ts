import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { TerminalConfigAuditService } from './terminal-config-audit.service';

const DEVICE_INFO = `<?xml version="1.0"?><DeviceInfo xmlns="http://www.isapi.org/ver20/XMLSchema"><model>DS-K1T671M</model><firmwareVersion>V3.7.0</firmwareVersion><firmwareReleasedDate>build 231019</firmwareReleasedDate></DeviceInfo>`;
const HOSTS = `<?xml version="1.0"?><HttpHostNotificationList xmlns="http://www.isapi.org/ver20/XMLSchema"><HttpHostNotification><id>1</id><url>/api/hikvision-push/SECRETTOKEN</url><protocolType>HTTP</protocolType><ipAddress>10.0.0.1</ipAddress><portNo>3001</portNo><SubscribeEvent><heartbeat>30</heartbeat><eventMode>all</eventMode><EventList><Event><type>AccessControllerEvent</type><pictureURLType>binary</pictureURLType></Event></EventList></SubscribeEvent></HttpHostNotification><HttpHostNotification><id>2</id><protocolType>EHome</protocolType></HttpHostNotification></HttpHostNotificationList>`;
const ACS = JSON.stringify({
  AcsCfg: {
    uploadCapPic: true,
    saveCapPic: false,
    uploadVerificationPic: true,
  },
});

describe('TerminalConfigAuditService', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const path = req.url ?? '';
      if (path.includes('deviceInfo')) res.end(DEVICE_INFO);
      else if (path.includes('httpHosts')) res.end(HOSTS);
      else if (path.includes('AcsCfg')) res.end(ACS);
      else {
        res.statusCode = 404;
        res.end('');
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('model, firmware, rasm va push sozlamalarini o‘qiydi; tokenni qaytarmaydi', async () => {
    const terminal = {
      id: 5,
      name: 'T5',
      host: '127.0.0.1',
      port,
      protocol: 'HTTP',
      username: 'admin',
      passwordEncrypted: 'x',
      eventSource: 'PUSH',
    };
    const builder = {
      addSelect: () => builder,
      where: () => builder,
      andWhere: () => builder,
      orderBy: () => builder,
      getMany: () => Promise.resolve([terminal]),
    };
    const service = new TerminalConfigAuditService(
      { createQueryBuilder: () => builder } as never,
      {
        query: () =>
          Promise.resolve([{ terminalId: 5, total: '10', inline: '4' }]),
      } as never,
      { decrypt: () => 'pw' } as never,
    );

    const result = await service.run();
    const item = result.items[0];

    expect(item).toMatchObject({
      id: 5,
      model: 'DS-K1T671M',
      firmware: 'V3.7.0',
      pictureUrlType: 'binary',
      pushTarget: '10.0.0.1:3001',
      heartbeat: '30',
      eventMode: 'all',
      uploadCapPic: true,
      saveCapPic: false,
      uploadVerificationPic: true,
      saveFacePic: null,
      todayTotal: 10,
      todayInline: 4,
      inlinePercent: 40,
      error: null,
    });
    expect(JSON.stringify(result)).not.toContain('SECRETTOKEN');
    expect(result.groups).toEqual([
      {
        key: 'DS-K1T671M · V3.7.0',
        terminals: 1,
        events: 10,
        inlinePercent: 40,
      },
    ]);
  });
});
