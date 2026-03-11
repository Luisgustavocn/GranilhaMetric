module.exports = {
  apps: [{
    name: 'granilha-metric',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    combine_logs: true,
    merge_logs: true,
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 3000,
    max_memory_restart: '500M',
    watch: false,
    // Graceful shutdown
    kill_timeout: 30000,
    listen_timeout: 10000,
    // Node.js args
    node_args: '--max-old-space-size=512'
  }]
};
