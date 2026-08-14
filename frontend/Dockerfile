# === Estágio 1: Build ===
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Variáveis injetadas no build via Build Args
ARG VITE_API_BASE
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# === Estágio 2: Servir ===
FROM nginx:alpine

# Copia o build estático para o nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuração do nginx para SPA (redireciona rotas para index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
