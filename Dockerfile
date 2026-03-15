FROM node:20-alpine AS build
WORKDIR /app
ENV PATH=/app/node_modules/.bin:$PATH
COPY package.json ./
COPY package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . ./
RUN npm run build

# production environment
FROM nginx:alpine
RUN apk add --no-cache gettext
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["sh", "-c", "envsubst '$PORT $GATEWAY_URL' < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
