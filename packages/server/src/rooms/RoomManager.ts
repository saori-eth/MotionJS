import { Room, RoomConfig } from './Room.js';
import { Database } from '../database/Database.js';
import { ScriptLoader } from '../scripting/ScriptLoader.js';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private scriptLoader: ScriptLoader | null = null;
  private defaultConfig: RoomConfig = {
    maxPlayers: 10,
    tickRate: 60
  };
  
  constructor(private database: Database) {}
  
  setScriptLoader(scriptLoader: ScriptLoader): void {
    this.scriptLoader = scriptLoader;
  }
  
  async getOrCreateRoom(roomId: string, config?: Partial<RoomConfig>): Promise<Room> {
    let room = this.rooms.get(roomId);
    
    if (!room) {
      const roomConfig = { ...this.defaultConfig, ...config };
      room = new Room(roomId, roomConfig, this.database);
      this.rooms.set(roomId, room);
      console.log(`Created room: ${roomId}`);
      
      // Execute scripts for the new room
      if (this.scriptLoader) {
        await this.scriptLoader.executeScriptsForRoom(room.world);
      }
    }
    
    return room;
  }
  
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }
  
  removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.stop();
      this.rooms.delete(roomId);
      console.log(`Removed room: ${roomId}`);
    }
  }
  
  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }
  
  shutdown(): void {
    for (const room of this.rooms.values()) {
      room.stop();
    }
    this.rooms.clear();
  }
}