# Terminal HTTP Push, smenalar va jonli efir

## Arxitektura

```
Terminal ──HTTP POST──▶ push-ingest (PUSH_PORT, cluster)
                          │  token → xotiradagi kesh (MySQL'siz)
                          │  faqat yuz eventlari; rasm → uploads/attendance/...
                          ▼
                    Redis Stream  edav:push:events
                          ▼
                    push-worker (consumer group, paket 500)
                          ├─ INSERT ... ON DUPLICATE KEY (bitta so‘rov)
                          ├─ daily_attendance inkremental UPDATE
                          ├─ kunning 1-eventida + har 15 daqiqada to‘liq rebuild
                          └─ PUBLISH edav:live:school:<id>
                                   ▼
                    API (PORT) ─ SSE ─▶ /live sahifasi
```

* **Asosiy API (`PORT`, 3000)** terminal trafigini umuman ko‘rmaydi — terminallar qanchalik ko‘p event yuborsa ham sayt sekinlashmaydi.
* **Ingest** har so‘rovda MySQL’ga murojaat qilmaydi — faqat bitta `XADD`, shuning uchun darhol javob beradi.
* Navbat `PUSH_MAX_BACKLOG` dan oshsa yoki Redis ishlamasa — `503 Retry-After`, terminal eventni keyin qayta yuboradi (event yo‘qolmaydi).
* Worker MySQL ishlamay qolsa xabarni ACK qilmaydi — tiklangach davom etadi. Takrorlarni unique index to‘sadi.

## Ishga tushirish

```bash
yarn build
yarn migration:run
pm2 start ecosystem.config.cjs
```

yoki alohida: `yarn start:prod`, `yarn start:push`, `yarn start:push-worker`.

`push-ingest` va `push-worker` asosiy API bilan **bir xil papkadan** ishga tushirilishi kerak (rasmlar `uploads/attendance` ga yoziladi).

## `.env` ga qo‘shiladigan sozlamalar

| O‘zgaruvchi | Standart | Izoh |
|---|---|---|
| `PUSH_PORT` | 3001 | Terminallar ulanadigan port |
| `PUSH_HOST` | 0.0.0.0 | |
| `PUSH_PUBLIC_URL` | — | Masalan `http://203.0.113.10:3001`. Token yaratilganda to‘liq URL qaytadi |
| `PUSH_WORKERS` | min(CPU, 4) | Ingest jarayonlari soni |
| `PUSH_MAX_IN_FLIGHT` | 2000 | Bir jarayondagi parallel so‘rovlar chegarasi |
| `PUSH_MAX_RPS_PER_TERMINAL` | 30 | Nosoz terminaldan himoya |
| `PUSH_MAX_BACKLOG` | 1000000 | Navbat chegarasi (keyin 503) |
| `PUSH_BODY_LIMIT_BYTES` | 2097152 | Rasm bilan so‘rov hajmi |
| `PUSH_SAVE_PICTURES` | true | `false` — rasm faqat pictureURL orqali |
| `PUSH_BATCH_SIZE` | 500 | Worker paketi |
| `PUSH_CONSUMER_CONCURRENCY` | 2 | Bir workerdagi parallel oqimlar |
| `PUSH_WORKER_DB_POOL` | 10 | Worker MySQL ulanishlari |
| `PUSH_REBUILD_CONCURRENCY` | 4 | Parallel to‘liq rebuildlar |
| `PUSH_RECONCILE_MINUTES` | 15 | Faol maktab-kun uchun nazorat rebuildi oralig‘i |
| `PUSH_SEED_DELAY_MS` | 5000 | Kunning 1-eventidan keyin rebuild kechikishi |

## Terminalni sozlash (Hikvision)

1. Super admin: `POST /api/terminals/:id/push/token` → `url` (yoki `path`) qaytadi. Token bir marta ko‘rsatiladi.
2. Terminal veb-paneli: *Network → Advanced → HTTP Listening* (yoki *Event Alarm → HTTP Host*):
   manzil — server IP, port — `PUSH_PORT`, URL — `/api/hikvision-push/<token>`, protokol HTTP.
3. *Picture uploading* ni yoqing — yuz rasmi event bilan birga keladi va darhol saqlanadi.

Polling sinxronlash ishlashda davom etadi: push o‘tkazib yuborgan eventlarni u to‘ldiradi, takror yozilmaydi.

## 10 000 terminal uchun server

* `ulimit -n 65535` (har terminal bitta keep-alive ulanish).
* Oldida nginx bo‘lsa: `client_max_body_size 3m; proxy_http_version 1.1; proxy_set_header Connection "";` va `keepalive` upstream.
* `/api/live/*/stream` uchun nginx'da `proxy_buffering off; proxy_read_timeout 1h;`.
* Redis `maxmemory-policy noeviction` bo‘lishi kerak (stream o‘chib ketmasin).

## Jonli efir sahifasi (`/live`)

* O‘tishlar SSE orqali ~1 soniyada chiqadi (ism, o‘quvchi/o‘qituvchi, sinf, rasm).
* Kamera: terminalning `/ISAPI/Streaming/channels/101/picture` kadri ~3 kadr/s. To‘liq silliq video (25 kadr/s) kerak bo‘lsa — RTSP'ni go2rtc/MediaMTX orqali WebRTC/HLS ga aylantirish kerak (alohida servis).

## Smenalar

* `GET/PUT /api/schools/:schoolId/shifts` — 1- va 2-smena vaqtlari.
* `PUT /api/classes/shifts` `{ classIds: [...], shiftCode: 1|2, startDate? }` — bir nechta sinfni bugundan (yoki kelajak sanadan) smenaga o‘tkazish. Tarix saqlanadi: o‘tgan kunlar eski smenada qoladi.
* `GET /api/classes/page?shift=1|2|NONE` — filtr; har sinfda `shift` maydoni.
