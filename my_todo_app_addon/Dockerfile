ARG BUILD_FROM
# Builder stage
FROM $BUILD_FROM as builder

# Install Node.js and npm in the builder stage
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy only package.json and package-lock.json first to leverage caching
# This ensures npm install is only re-run if dependencies change
COPY backend/package.json backend/package-lock.json ./backend/

# Install Node.js dependencies for the backend
RUN npm install --prefix ./backend --production --no-audit

# Now copy the rest of your application code
COPY backend ./backend
COPY frontend ./frontend

# --- Production/Runtime Stage ---
FROM $BUILD_FROM

# Install Node.js (without npm, as it's not needed at runtime)
# We only need the Node.js runtime here.
RUN apk add --no-cache nodejs

WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend ./frontend

# Ensure the data directory exists
RUN mkdir -p /data

# Copy the simplified run.sh to the root of the container and make it executable
COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3000

CMD ["/run.sh"]