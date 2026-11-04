# Imagen ligera de Node 22. La app no tiene dependencias: no hay npm install.
FROM node:22-alpine

# Zona horaria de las reglas de las 12 horas (el contenedor va en UTC por defecto).
ENV NODE_ENV=production \
    TZ=Europe/Madrid \
    PORT=3210

WORKDIR /app
COPY --chown=node:node . .

# Los datos viven en /app/data/db.json. Esa carpeta es el VOLUMEN PERSISTENTE:
# en Coolify, Storages -> Add -> Destination Path: /app/data
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

USER node
EXPOSE 3210

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3210)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
