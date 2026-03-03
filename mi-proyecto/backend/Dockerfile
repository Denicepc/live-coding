# Usa una imagen ligera de Node
FROM node:20-alpine

# Crea el directorio de trabajo
WORKDIR /app

# Copia los archivos de dependencias y las instala
COPY package*.json .
RUN npm install --omit=dev

# Copia el resto del código
COPY . .

# Creamos la carpeta donde vivirá la base de datos SQLite
RUN mkdir -p /app/data

# Expone el puerto que usa tu app
EXPOSE 3000

# Comando para arrancar la app
CMD ["node", "app.js"]