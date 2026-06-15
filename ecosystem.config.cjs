module.exports = {
  apps: [{
    name: 'carcassonne-server',
    script: 'npx',
    args: 'tsx server/index.ts',
    cwd: '/var/www/carcassonne-app',
    env: {
      NODE_ENV: 'production',
      PORT: '3001',
    },
    restart_delay: 3000,
    max_restarts: 10,
  }]
};
