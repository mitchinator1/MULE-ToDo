#!/usr/bin/with-contenv bashio
# This shebang is correct for Home Assistant Add-ons

set -e # Exit immediately if a command exits with a non-zero status.

bashio::log.info "Starting My To-Do App backend..."

# Use bashio::config for port, with a default fallback
# It's good practice to ensure these are explicitly exported for the Node.js process
export PORT=$(bashio::config 'port_internal' || echo 3000)
export DATABASE_PATH="/data/todo.db" # This path is critical for SQLite persistence

# Validate that the Node.js executable can be found
NODE_BIN=$(which node)
if [ -z "$NODE_BIN" ]; then
    bashio::log.error "Node.js executable not found in PATH!"
    exit 1
fi

bashio::log.info "Node.js binary path: ${NODE_BIN}"
bashio::log.info "Database path: ${DATABASE_PATH}"
bashio::log.info "Server will listen on port: ${PORT}"

# Execute the Node.js application.
# The 'exec' command is crucial: it replaces the current shell process (run.sh)
# with the Node.js process, ensuring Node.js runs as PID 1.
exec "$NODE_BIN" /app/backend/server.js
