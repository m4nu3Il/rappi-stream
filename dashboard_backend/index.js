
const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const PORT = parseInt(process.env.PORT || '8080', 10);
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, 'public');

const app = express();
app.use(express.static(STATIC_DIR));
app.get('/', (_, res) => res.sendFile(path.join(STATIC_DIR, 'dashboard.html')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const clients = new Set();
let lastState = {};

wss.on('connection', (ws, req) => {
  const isAggregator = req.url.includes('ws');
  ws.isAggregator = false; // aggregator will just send updates, clients will receive
  clients.add(ws);
  console.log('[dashboard_backend] Cliente WebSocket conectado');
  // Al conectar cliente, enviamos estado actual si existe
  ws.send(JSON.stringify({ type: 'state', data: lastState }));
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'state_update') {
        lastState = msg.data || {};
        // Broadcast a todos los clientes (incluyendo quien envió)
        for (const c of clients) {
          try { c.send(JSON.stringify({ type: 'state', data: lastState })); } catch {}
        }
      }
    } catch (err) {
      console.error('[dashboard_backend] Mensaje no válido', err);
    }
  });
  ws.on('close', () => { clients.delete(ws); });
});

server.listen(PORT, () => console.log(`[dashboard_backend] Servidor en http://localhost:${PORT}`));
