FROM node:22-alpine

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --no-audit --no-fund

COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
