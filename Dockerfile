# ---- build stage: install everything, build the web bundle ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:web

# ---- runtime stage: prod deps only, serve static + API from one process ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
# server runs via tsx (a runtime dependency); it imports shared types from src/
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src ./src
COPY tsconfig.server.json ./
EXPOSE 3001
CMD ["npm", "run", "start"]
