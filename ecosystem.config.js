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
  ],
}
