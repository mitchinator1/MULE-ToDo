#!/usr/bin/with-contenv bashio
# This line is crucial for Home Assistant add-ons to use bashio functions

# Set -e makes the script exit if any command fails
set -e

# Log information from bashio
bashio::log.info "Starting My To-Do App backend..."

# Define the port from environment variable, fallback to 3000
# bashio::config reads values from the add-on's config
PORT=$(bashio::config 'port_internal' || echo 3000) # Use a specific config option or fallback

# Define the database path
# Home Assistant add-ons typically use /data for persistent storage
DATABASE_PATH="/data/todo.db" # This should match your backend/server.js expectation

# Ensure the database directory exists if /data is not mounted by HA
mkdir -p "$(dirname "${DATABASE_PATH}")"

bashio::log.info "Database path: ${DATABASE_PATH}"
bashio::log.info "Server will listen on port: ${PORT}"

# Start your Node.js application
# We pass the environment variables directly here
# The `exec` command replaces the shell process with the node process,
# which is good for Docker as signals (like stop) go directly to the app.
exec node /app/backend/server.js
