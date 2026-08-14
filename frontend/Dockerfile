# === Estágio 1: Build ===
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Argumentos com valores padrão para build no servidor de produção
ARG VITE_API_BASE="https://agrous-backend.rfhelf.easypanel.host"
ARG VITE_SUPABASE_URL="https://nnxpeitozjsgdbjzvbxt.supabase.co"
ARG VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHBlaXRvempzZ2Rianp2Ynh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODcwNjgsImV4cCI6MjEwMTk2MzA2OH0.jptsAMPv2mRXL_PIZtCXvAH3MTTeWD_OrKXkKGAKBls"

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
