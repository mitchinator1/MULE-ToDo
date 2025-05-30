ARG BUILD_FROM
FROM $BUILD_FROM

RUN apk add --no-cache nodejs npm

WORKDIR /app

COPY src/backend /app/backend
COPY src/frontend /app/frontend

RUN npm install --prefix /app/backend

RUN mkdir -p /data

COPY root/ /

RUN chmod a+x /etc/services.d/my_todo_app/run
RUN chmod a+x /etc/services.d/my_todo_app/finish

EXPOSE 3000

# !!! CRUCIAL TEMPORARY CHANGE: Override the CMD to just run a shell !!!
# This stops s6-overlay from starting your service automatically.
# We will manually start it to see the error.
CMD ["/bin/bash"]
