module.exports = {
  apps: [{
    name: 'aicarpool-edge',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 8080,
      DEBUG: 'true'
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_file: 'logs/pm2-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    cron_restart: '0 2 * * *', // 每天凌晨2点重启
    ignore_watch: [
      'node_modules',
      'logs',
      'certs'
    ]
  }]
};