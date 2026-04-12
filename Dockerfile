FROM node:24-alpine AS build
WORKDIR /app
ENV PATH=/app/node_modules/.bin:$PATH
COPY package.json ./
COPY package-lock.json ./
COPY scripts ./scripts
RUN npm ci --no-audit --no-fund
COPY . ./
RUN npm run typecheck
RUN npm run build

# production environment
FROM nginx:alpine
RUN apk add --no-cache gettext
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["sh", "-c", "set -eu; export PORT=\"${PORT:-80}\" GATEWAY_PROTOCOL=\"${GATEWAY_PROTOCOL:-https}\" GATEWAY_PORT=\"${GATEWAY_PORT:-443}\"; : \"${GATEWAY_URL:?GATEWAY_URL must be set to the gateway host without protocol}\"; envsubst '$PORT $GATEWAY_URL $GATEWAY_PROTOCOL $GATEWAY_PORT' < /etc/nginx/conf.d/default.conf > /tmp/default.conf && mv /tmp/default.conf /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
