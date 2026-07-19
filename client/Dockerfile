FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite dev server — expose on 0.0.0.0 so Docker can forward the port
CMD ["npx", "vite", "--host", "0.0.0.0"]
