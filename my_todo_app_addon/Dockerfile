FROM node:20-alpine

WORKDIR /opt

# Copy backend files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy server code
COPY backend/server.js ./backend/server.js

# Copy static frontend (optional if serving via Node)
COPY frontend ./frontend

# Copy run script
COPY run /run
RUN chmod +x /run

EXPOSE 3000

CMD ["/run"]
