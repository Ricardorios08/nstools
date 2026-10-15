#!/bin/bash

SERVER_IP="192.168.133.15"
APP_PATH="/opt/osep/osep-conversor-app"
APP_NAME="osep-conversor-app"

# 1. Te pide el usuario por consola
echo -n "👤 Ingresá tu usuario del servidor Linux: "
read SERVER_USER

if [ -z "$SERVER_USER" ]; then
    echo "❌ El usuario no puede estar vacío."
    exit 1
fi

echo "🛫 Conectando a $SERVER_IP como '$SERVER_USER'..."
echo "🔒 Te va a pedir la contraseña del servidor a continuación."

# 2. Conexión SSH interactiva (-t) ejecutando el bloque de comandos
ssh -t "${SERVER_USER}@${SERVER_IP}" << EOF
    echo "📂 Entrando al directorio del proyecto..."
    cd $APP_PATH || { echo "❌ No se encontró la carpeta"; exit 1; }

    echo "⬇️ Haciendo Git Pull..."
    git pull origin principal

    echo "🛑 Deteniendo el proceso en PM2..."
    pm2 stop $APP_NAME || echo "⚠️ El proceso no estaba corriendo."

    echo "📦 Instalando dependencias del Backend..."
    npm install

    echo "🏗️ Buildeando el Frontend de React..."
    cd frontend
    npm install
    npm run build
    cd ..

    echo "📋 Copiando dist a la raíz..."
    node copy-dist.js

    echo "🔄 Levantando el backend en PM2..."
    pm2 restart $APP_NAME --update-env || pm2 start src/index.js --name "$APP_NAME"
    pm2 save

    echo "🌐 Recargando Nginx (puede pedir tu contraseña de sudo)..."
    sudo systemctl restart nginx

    echo "🎉 ¡Proceso remoto terminado!"
EOF

echo "✅ Script local finalizado."