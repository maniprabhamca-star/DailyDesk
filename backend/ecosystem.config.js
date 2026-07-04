// pm2 process definition for the DiemDesk API.
//
// Cluster mode runs multiple worker processes behind pm2's shared socket, so the
// API uses more than one CPU core (auth/bcrypt is CPU-bound). The workers are
// stateless — sessions are JWTs and the rate limiter is Redis-backed — so they
// scale horizontally with no shared in-process state. `pm2 reload` gives a
// rolling, zero-downtime restart on deploy.
//
// 2 instances on the current 4-core box leaves headroom for the frontend,
// Postgres, Redis, and bursty LibreOffice conversions. Bump `instances` (up to
// `'max'`) as the box grows or conversions move to their own workers.
module.exports = {
  apps: [
    {
      name: 'dailydesk-backend',
      script: 'src/index.js',
      cwd: __dirname,
      exec_mode: 'cluster',
      instances: 2,
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
