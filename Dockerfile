FROM node:20-alpine AS web-build

WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
RUN cd frontend && npm run build


FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Copy built Vue app into /app/dist
COPY --from=web-build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
