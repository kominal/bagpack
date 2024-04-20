FROM mongo:latest
RUN apt update && apt install -y curl git
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs
WORKDIR /usr/src/app/
ENV NODE_ENV production
COPY package.json /usr/src/app/
COPY package-lock.json /usr/src/app/
COPY dist/ /usr/src/app/
COPY node_modules /usr/src/app/node_modules
CMD ["node", "--unhandled-rejections=strict", "main.js"]
