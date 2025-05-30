FROM node:20-alpine

WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy app code
COPY . .

# Set permissions for s6-overlay (if needed)
RUN chmod +x /app/run

# Tell s6-overlay this is the service to start
CMD [ "/app/run" ]
