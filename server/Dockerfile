FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

# Run migrations then start the dev server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
