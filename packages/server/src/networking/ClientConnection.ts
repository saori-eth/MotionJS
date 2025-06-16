import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { 
  ClientMessage, 
  ServerMessage, 
  MessageType,
  ErrorMessage,
  ScriptMessage 
} from '@motionjs/common';
import { RoomManager } from '../rooms/RoomManager.js';
import { EventEmitter } from 'events';

export class ClientConnection extends EventEmitter {
  public readonly id: string;
  private playerId: string | null = null;
  private roomId: string | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private ws: WebSocket,
    private roomManager: RoomManager
  ) {
    super();
    this.id = nanoid();
    
    this.setupEventHandlers();
    this.startPingInterval();
  }
  
  private setupEventHandlers(): void {
    this.ws.on('message', (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.sendError('INVALID_MESSAGE', 'Invalid message format');
      }
    });
    
    this.ws.on('close', () => {
      this.handleDisconnect();
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnect();
    });
  }
  
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }
  
  private handleMessage(message: ClientMessage): void {
    switch (message.type) {
      case MessageType.JoinRoom:
        this.handleJoinRoom(message.roomId, message.playerName);
        break;
        
      case MessageType.LeaveRoom:
        this.handleLeaveRoom();
        break;
        
      case MessageType.PlayerInput:
        if (this.roomId && this.playerId) {
          const room = this.roomManager.getRoom(this.roomId);
          room?.handlePlayerInput(this.playerId, message.input);
        }
        break;
        
      case MessageType.ScriptMessage:
        if (this.roomId && this.playerId) {
          const room = this.roomManager.getRoom(this.roomId);
          room?.handleScriptMessage(this.playerId, message.channel, message.data, message.targetPlayerId);
        }
        break;
    }
  }
  
  private async handleJoinRoom(roomId: string, playerName: string): Promise<void> {
    if (this.roomId) {
      this.handleLeaveRoom();
    }
    
    const room = await this.roomManager.getOrCreateRoom(roomId);
    const result = room.addPlayer(this.id, playerName, this);
    
    if (result.success) {
      this.roomId = roomId;
      this.playerId = result.playerId!;
    } else {
      this.sendError('ROOM_FULL', result.error || 'Failed to join room');
    }
  }
  
  private handleLeaveRoom(): void {
    if (this.roomId && this.playerId) {
      const room = this.roomManager.getRoom(this.roomId);
      room?.removePlayer(this.playerId);
      
      this.roomId = null;
      this.playerId = null;
    }
  }
  
  private handleDisconnect(): void {
    this.handleLeaveRoom();
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    this.emit('disconnect');
  }
  
  send(message: ServerMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  private sendError(code: string, message: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.Error,
      code,
      message
    };
    this.send(errorMessage);
  }
  
  disconnect(): void {
    this.ws.close();
  }
  
  getPlayerId(): string | null {
    return this.playerId;
  }
}