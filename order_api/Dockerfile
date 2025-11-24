
# syntax=docker/dockerfile:1
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --progress=false || npm install --no-audit --progress=false
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
