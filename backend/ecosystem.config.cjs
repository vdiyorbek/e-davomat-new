// PM2: `pm2 start ecosystem.config.cjs` (avval `yarn build`).
// Uch alohida jarayon — biri qotsa yoki band bo‘lsa, qolganlari ishlayveradi.
module.exports = {
  apps: [
    {
      // Asosiy API va sayt backendi: PORT (3000)
      name: 'edavomat-api',
      script: 'dist/main.js',
      max_memory_restart: '1500M',
    },
    {
      // Terminal HTTP Push qabul qiluvchi: PUSH_PORT (3001).
      // O‘zi cluster rejimida PUSH_WORKERS ta yadroda ishlaydi.
      name: 'edavomat-push',
      script: 'dist/push-ingest/main.js',
      env: { UV_THREADPOOL_SIZE: '16' },
      kill_timeout: 15000,
    },
    {
      // Navbat → MySQL → daily_attendance → jonli efir.
      // Yuklama oshsa `instances` ni oshiring (consumer group).
      name: 'edavomat-push-worker',
      script: 'dist/push-worker.js',
      instances: 1,
      kill_timeout: 30000,
    },
  ],
};
