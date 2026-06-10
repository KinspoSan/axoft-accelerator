// PM2 конфиг для VPS-деплоя
// Запуск: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [{
    name:        'axoft-lk',
    script:      'server/index.js',
    interpreter: 'node',
    instances:   1,
    autorestart: true,
    watch:       false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT:     3000,
    },
  }],
};
