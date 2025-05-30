ARG BUILD_FROM
FROM $BUILD_FROM

# !!! IMPORTANT: Install Node.js and npm !!!
# Use apk for Alpine-based images.
# This adds the necessary packages to run Node.js and npm.
RUN apk add --no-cache nodejs npm

WORKDIR /app

COPY src/backend /app/backend
COPY src/frontend /app/frontend

RUN npm install --prefix /app/backend

RUN mkdir -p /data

COPY run.sh /usr/bin/run.sh
RUN chmod a+x /usr/bin/run.sh

EXPOSE 3000

CMD ["/usr/bin/run.sh"]
