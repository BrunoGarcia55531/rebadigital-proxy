# RebaDigital — Prototipo con IA (Gemini, gratis)

Prototipo interactivo del Hospital Rebagliati con asistente NLP real (Google Gemini).
El proxy resuelve el bloqueo CORS al intermediar las llamadas a la API de Gemini.

```
[Navegador] → /api/chat → [Proxy Node.js] → [Google Gemini API]
```

## Requisitos

- Node.js 18 o superior  →  https://nodejs.org
- Una API key GRATUITA de Gemini  →  https://aistudio.google.com/app/apikey
  (no pide tarjeta de crédito, solo iniciar sesión con cuenta de Google)

## Instalación (una sola vez)

```bash
# 1. Entrar a la carpeta
cd rebadigital-proxy

# 2. Instalar dependencias
npm install

# 3. Crear el archivo .env con tu API key
cp .env.example .env
# Abre .env con cualquier editor y pega tu key:
# GEMINI_API_KEY=AIza...
```

## Uso

```bash
npm start
```

Luego abre el navegador en:  **http://localhost:3000**

## Límites del plan gratuito (referencia)

El modelo usado es `gemini-2.5-flash`. El plan gratuito de Google AI Studio
permite aproximadamente 10 solicitudes por minuto y 250 por día — más que
suficiente para una demo o sustentación académica.

## Estructura

```
rebadigital-proxy/
├── server.js          ← proxy Express, traduce el chat al formato de Gemini
├── .env               ← tu API key (no subir a Git)
├── .env.example       ← plantilla
├── package.json
└── public/
    └── index.html     ← el prototipo HTML
```

## Notas

- El archivo `.env` **nunca** debe subirse a GitHub. Agrega `.env` a tu `.gitignore`.
- El proxy solo acepta conexiones desde `localhost`. Para desplegarlo en la nube
  (Render, Railway, Vercel) hay que ajustar la política CORS en `server.js`.
