// server.js - Multiplayer 2D Battle Royale
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

let nextId = 1;
const players = new Map();

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  const id = nextId++;
  ws.id = id;
  players.set(id, { id, x: Math.random()*1100+50, y: Math.random()*600+50, dir:0, hp:100 });

  ws.send(JSON.stringify({ type: 'init', data: { id, players: Array.from(players.values()) } }));
  broadcast('players_update', Array.from(players.values()));

  ws.on('message', (msg) => {
    try {
      const { type, data } = JSON.parse(msg);
      const p = players.get(id);
      if (!p) return;

      if (type === 'input') {
        if (data.x !== undefined) p.x = data.x;
        if (data.y !== undefined) p.y = data.y;
        if (data.dir !== undefined) p.dir = data.dir;
        if (data.hp !== undefined) p.hp = data.hp;
      } else if (type === 'shoot') {
        broadcast('shoot', { id, x: data.x, y: data.y, vx: data.vx, vy: data.vy });
      }
    } catch (e) {
      console.error(e);
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast('players_update', Array.from(players.values()));
  });
});

setInterval(() => {
  broadcast('players_update', Array.from(players.values()));
}, 200);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on', PORT));
