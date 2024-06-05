FROM node:lts

WORKDIR /app

RUN npm install -g pnpm

# Copy the current directory contents into the container at /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/

RUN pnpm install

COPY . /app

CMD ["pnpm", "run", "start-server"]
