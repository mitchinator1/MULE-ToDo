ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy your application source code
COPY backend /app/backend
COPY frontend /app/frontend

# Install backend dependencies
RUN npm install --prefix /app/backend

# Copy service run script into place
COPY root/ /

# Ensure the run script is executable
RUN chmod a+x /etc/services.d/my_todo_app/run

# Expose the correct port
EXPOSE 3000

# Let the base image's /init handle service startup via S6
CMD ["/init"]
