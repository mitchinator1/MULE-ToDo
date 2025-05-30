ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy your application source code
COPY src/backend /app/backend
COPY src/frontend /app/frontend

# Install Node.js dependencies for the backend
RUN npm install --prefix /app/backend

# Ensure the data directory exists
RUN mkdir -p /data

# !!! CRUCIAL: Copy the 'root' filesystem overlay for s6-overlay services !!!
# This copies /etc/services.d/my_todo_app/run and /etc/services.d/my_todo_app/finish
COPY root/ /

# !!! CRUCIAL: Make the service scripts executable !!!
# Without this, s6-overlay cannot execute them and will fail.
RUN chmod a+x /etc/services.d/my_todo_app/run
RUN chmod a+x /etc/services.d/my_todo_app/finish # If finish is used and needs to be executable

EXPOSE 3000

# !!! CRUCIAL CMD: Let s6-overlay manage services automatically !!!
# This is the standard entrypoint for Home Assistant add-ons when using s6-overlay.
CMD ["/init"]
