FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM httpd:2.4
RUN sed -i '/LoadModule rewrite_module/s/^#//g' /usr/local/apache2/conf/httpd.conf

COPY --from=build /app/dist/ /usr/local/apache2/htdocs/

COPY spa-rewrite.conf /usr/local/apache2/conf/extra/spa-rewrite.conf
RUN echo "Include conf/extra/spa-rewrite.conf" >> /usr/local/apache2/conf/httpd.conf
