require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Permitir cualquier origen local (ajusta en producción)
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'null'] }));
app.use(express.json());

// Sirve el HTML del prototipo como raíz
app.use(express.static(path.join(__dirname, 'public')));

// Pequeña espera entre intentos
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Llama a Gemini con reintentos automáticos si el modelo está saturado (503/429)
async function callGemini(model, apiKey, geminiBody, maxRetries = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(geminiBody)
    });

    const data = await response.json();

    // 503 = modelo saturado, 429 = rate limit -> reintentar con backoff
    const retriable = response.status === 503 || response.status === 429;
    if (!response.ok && retriable && attempt < maxRetries) {
      const wait = Math.min(8000, 1000 * Math.pow(2, attempt)); // 1s, 2s, 4s...
      console.warn(`⚠️  Gemini ${response.status}, reintentando en ${wait}ms (intento ${attempt + 1}/${maxRetries})`);
      await sleep(wait);
      continue;
    }

    return { ok: response.ok, status: response.status, data };
  }
}

// ── Proxy hacia Google Gemini ──────────────────────────────────────────────
// Recibe el mismo formato que usaba el frontend para Anthropic:
// { system: "...", messages: [{role:'user'|'assistant', content:'...'}] }
// y lo traduce al formato de Gemini antes de reenviarlo.
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta GEMINI_API_KEY en .env' });
  }

  const { system, messages = [] } = req.body;

  // Gemini usa "model" -> "user", "user" -> "user" no existe el rol "system" en contents,
  // se manda aparte como system_instruction. El rol "assistant" se traduce a "model".
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const geminiBody = {
    contents,
    ...(system ? { system_instruction: { parts: [{ text: system }] } } : {})
  };

  // Si el modelo principal está saturado, se intenta con un modelo de respaldo
  const PRIMARY_MODEL  = 'gemini-2.5-flash';
  const FALLBACK_MODEL = 'gemini-2.0-flash';

  try {
    let result = await callGemini(PRIMARY_MODEL, apiKey, geminiBody);

    if (!result.ok && (result.status === 503 || result.status === 429)) {
      console.warn(`⚠️  ${PRIMARY_MODEL} no disponible tras reintentos, probando ${FALLBACK_MODEL}...`);
      result = await callGemini(FALLBACK_MODEL, apiKey, geminiBody, 1);
    }

    if (!result.ok) {
      console.error('❌ Gemini devolvió error:', JSON.stringify(result.data, null, 2));
      return res.status(result.status).json(result.data);
    }

    // Traduce la respuesta de Gemini al mismo formato que el frontend espera
    // (el mismo shape que devolvía Anthropic: data.content[0].text)
    const text = result.data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    res.json({ content: [{ type: 'text', text }] });

  } catch (err) {
    console.error('Error al llamar a Gemini:', err.message);
    res.status(502).json({ error: 'No se pudo conectar con la API de Gemini' });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅  RebaDigital Proxy corriendo en http://localhost:${PORT}`);
  console.log(`   Abre el prototipo en:  http://localhost:${PORT}/index.html\n`);
});
