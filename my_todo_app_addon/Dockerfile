# Use a small Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /opt

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy app files
COPY server.js ./
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Expose port
EXPOSE 3000

# Run the server
CMD [ "/run.sh" ]
