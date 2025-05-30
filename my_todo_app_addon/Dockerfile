ARG BUILD_FROM
FROM $BUILD_FROM

# No need for separate ENV PORT and DATABASE_PATH here, as run.sh handles them
# ENV PORT=3000
# ENV DATABASE_PATH=/data/todo.db # run.sh will define this from bashio::config or hardcode

WORKDIR /app

COPY src/backend /app/backend
COPY src/frontend /app/frontend

RUN npm install --prefix /app/backend

# Ensure the data directory exists (though run.sh will also ensure it)
RUN mkdir -p /data

# !!! CRUCIAL: Copy the run.sh script and make it executable !!!
COPY run.sh /usr/bin/run.sh
RUN chmod a+x /usr/bin/run.sh

EXPOSE 3000 # Still good to expose the port in the Dockerfile

# !!! CRUCIAL: Change CMD to execute run.sh !!!
CMD ["/usr/bin/run.sh"]
