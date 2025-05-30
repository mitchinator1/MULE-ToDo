ARG BUILD_FROM
FROM $BUILD_FROM

ENV PORT=3000
ENV DATABASE_PATH=/data/todo.db

WORKDIR /app

# Copy your entire application source from the 'src' directory
COPY src/backend /app/backend
COPY src/frontend /app/frontend

# Install Node.js dependencies for the backend
RUN npm install --prefix /app/backend

# Ensure the data directory exists
RUN mkdir -p /data

EXPOSE 3000

# Command to start your Node.js backend server, specifying its path relative to /app
CMD ["node", "/app/backend/server.js"]
