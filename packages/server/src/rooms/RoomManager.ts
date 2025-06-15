import { Room, RoomConfig } from './Room.js';
import { Database } from '../database/Database.js';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private defaultConfig: RoomConfig = {
    maxPlayers: 10,
    tickRate: 60
  };
  
  constructor(private database: Database) {}
  
  getOrCreateRoom(roomId: string, config?: Partial<RoomConfig>): Room {
    let room = this.rooms.get(roomId);
    
    if (!room) {
      const roomConfig = { ...this.defaultConfig, ...config };
      room = new Room(roomId, roomConfig, this.database);
      this.rooms.set(roomId, room);
      console.log(`Created room: ${roomId}`);
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