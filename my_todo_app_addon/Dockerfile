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

# !!! IMPORTANT: Remove the root/ copy and chmod for services.d scripts !!!
# COPY root/ /
# RUN chmod a+x /etc/services.d/my_todo_app/run
# RUN chmod a+x /etc/services.d/my_todo_app/finish

# Copy the simplified run.sh to the root of the container and make it executable
COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3000

# !!! CRUCIAL: Use the simplified run.sh as CMD, as per tutorial's working example !!!
CMD ["/run.sh"]
