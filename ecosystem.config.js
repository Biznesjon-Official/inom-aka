module.exports = {
  apps: [
    {
      name: 'inomaka-crm',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/inomaka-crm',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'bot',
      script: 'bot/index.ts',
      interpreter: './node_modules/.bin/tsx',
      cwd: '/var/www/inomaka-crm',
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
