import { GameServer } from './core/GameServer.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

const server = new GameServer(PORT);
server.start();

process.on('SIGINT', () => {
  console.log('\\nShutting down server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\nShutting down server...');
  server.stop();
  process.exit(0);
});