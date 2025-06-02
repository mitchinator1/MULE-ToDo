#!/usr/bin/with-contenv bashio
# Use with-contenv bashio as per tutorial

set -e

bashio::log.info "Starting Node.js server for My To-Do App..."

# Get configuration from bashio::config.
# The environment variables are also set by config.yaml's 'environment' section.
# Using bashio::config explicitly here ensures they are correctly parsed if needed.
declare -i port_internal # Declare as integer
port_internal=$(bashio::config 'port_internal')

# Export environment variables for the Node.js application.
# Node.js will typically read these from process.env
export PORT="${port_internal}"
export DATABASE_PATH="/data/todo.db" # This is a static path, no need for bashio::config here

mkdir -p "$(dirname "${DATABASE_PATH}")"

bashio::log.info "Database path: ${DATABASE_PATH}"
bashio::log.info "Server will listen on port: ${PORT}"

# Find Node.js executable (good practice)
NODE_BIN=$(which node)
if [ -z "$NODE_BIN" ]; then
    bashio::log.error "Node.js executable not found in PATH!"
    exit 1
fi

# Execute the Node.js application.
# This should now directly become PID 1.
exec "$NODE_BIN" /app/backend/server.js
