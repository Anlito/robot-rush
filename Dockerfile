# Image du serveur Robot Rush (utilisée par Fly.io et Railway ; Render utilise directement Node).
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dépendances d'abord : couche mise en cache tant que package*.json ne change pas.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY public ./public
COPY seed ./seed
# Banque de départ facultative (voir DEPLOIEMENT.md) : copiée seulement si elle existe
# (package.json, toujours présent, évite l'erreur quand banque.json est absent).
COPY package.json banque.jso[n] ./

EXPOSE 3000
CMD ["node", "server/index.js"]
