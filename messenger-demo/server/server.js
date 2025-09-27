// server.js — Node.js WebSocket broadcast demo
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req,res)=>{
  res.writeHead(200); res.end('MiniMessenger WS server');
});
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      // Broadcast message to others (simple)
      if(data.type === 'message' || data.type === 'typing' || data.type === 'hello'){
        // add server timestamp
        if(data.type === 'message' && data.message) data.message.serverTs = Date.now();
        const out = JSON.stringify(data);
        wss.clients.forEach(c => {
          if(c.readyState === WebSocket.OPEN) c.send(out);
        });
      }
    } catch(e){
      console.warn('invalid incoming', e);
    }
  });

  ws.on('close', () => {});
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('WS server listening on', PORT));
