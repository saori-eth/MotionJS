import { WebSocketServer } from 'ws';
import { RoomManager } from '../rooms/RoomManager.js';
import { Database } from '../database/Database.js';
import { ClientConnection } from '../networking/ClientConnection.js';
import { ScriptLoader } from '../scripting/ScriptLoader.js';

export class GameServer {
  private wss: WebSocketServer | null = null;
  private roomManager: RoomManager;
  private database: Database;
  private scriptLoader: ScriptLoader;
  private connections: Map<string, ClientConnection> = new Map();

  constructor(private port: number) {
    this.database = new Database();
    this.roomManager = new RoomManager(this.database);
    this.scriptLoader = new ScriptLoader(this.roomManager, this.database);
    this.roomManager.setScriptLoader(this.scriptLoader);
  }

  async start(): Promise<void> {
    await this.database.initialize();
    await this.scriptLoader.loadScripts();

    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', ws => {
      const connection = new ClientConnection(ws, this.roomManager);
      this.connections.set(connection.id, connection);

      connection.on('disconnect', () => {
        this.connections.delete(connection.id);
      });
    });

    console.log(`Game server running on port ${this.port}`);
  }

  stop(): void {
    for (const connection of this.connections.values()) {
      connection.disconnect();
    }

    this.roomManager.shutdown();
    this.database.close();

    if (this.wss) {
      this.wss.close();
    }
  }
}
