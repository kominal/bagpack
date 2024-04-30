FROM node:18-slim
RUN apt update && apt install -y curl git gnupg curl
RUN curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
RUN echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
RUN apt update && apt install -y mongodb-org-tools
WORKDIR /usr/src/app/
ENV NODE_ENV production
COPY package.json /usr/src/app/
COPY package-lock.json /usr/src/app/
COPY dist/ /usr/src/app/
COPY node_modules /usr/src/app/node_modules
CMD ["node", "--unhandled-rejections=strict", "main.js"]
