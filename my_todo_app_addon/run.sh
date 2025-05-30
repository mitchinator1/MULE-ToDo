#!/usr/bin/with-contenv bashio
# Using with-contenv bashio is still standard, even if we skip bashio::log for now

set -e

# Directly set environment variables.
# bashio::config is great, but let's test without it being called if possible
# If your config.yaml always sets port_internal, you can hardcode here for test
export PORT=3000
export DATABASE_PATH="/data/todo.db"

# Find Node.js executable (good practice, keep this)
NODE_BIN=$(which node)
if [ -z "$NODE_BIN" ]; then
    echo "ERROR: Node.js executable not found in PATH!" >&2 # Log to stderr
    exit 1
fi

# This is the critical line: exec the Node.js process.
exec npm start --prefix /app/backend
