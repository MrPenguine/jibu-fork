module.exports = {
  apps: [
    {
      name: 'jibu-backend',
      script: 'pnpm',
      args: 'exec nx serve backend',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
    },
    {
      name: 'jibu-worker',
      script: 'pnpm',
      args: 'exec nx run worker:worker',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        WORKER_PORT: 3001,
      },
    },
    {
      name: 'jibu-frontend',
      script: 'pnpm',
      args: 'exec nx serve frontend',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: '1.5G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
    },
    {
      name: 'jibu-voice-agent',
      script: './venv/bin/python',
      args: 'src/main.py dev',
      cwd: './apps/livekit-agent',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PYTHONUNBUFFERED: '1',
      },
    },
  ],
};
