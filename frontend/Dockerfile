FROM node:20-alpine

WORKDIR /app

# Install dependencies first for caching layers
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Run Vite development server
CMD ["npm", "run", "dev", "--", "--host"]
