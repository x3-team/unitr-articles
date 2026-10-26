// PM2 (если на хостинге Reg.ru используется PM2 вместо systemd):
//   pm2 start deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "unitr-articles",
      cwd: "/var/www/unitr-articles/current",
      script: "server.js",
      env: { NODE_ENV: "production", PORT: 3000, HOSTNAME: "127.0.0.1" },
      // секреты не храним в репозитории: pm2 start ... --env-file /etc/unitr-articles.env (или переменные окружения пользователя)
      max_memory_restart: "512M",
    },
  ],
};
