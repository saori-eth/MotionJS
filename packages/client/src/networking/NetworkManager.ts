import { 
  ClientMessage, 
  ServerMessage, 
  MessageType,
  PlayerInput,
  JoinRoomMessage,
  LeaveRoomMessage,
  PlayerInputMessage
} from '@motionjs/common';
import { useGameStore } from '../store/gameStore';

export class NetworkManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private readonly reconnectDelay = 3000;
  
  constructor(private serverUrl: string) {}
  
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);
        
        this.ws.onopen = () => {
          console.log('Connected to server');
          useGameStore.getState().setConnected(true);
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };
        
        this.ws.onclose = () => {
          console.log('Disconnected from server');
          useGameStore.getState().setConnected(false);
          this.scheduleReconnect();
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(console.error);
    }, this.reconnectDelay);
  }
  
  private handleMessage(message: ServerMessage): void {
    const store = useGameStore.getState();
    
    switch (message.type) {
      case MessageType.RoomJoined:
        store.setRoomInfo(message.roomId, message.playerId);
        break;
        
      case MessageType.Snapshot:
        store.updateSnapshot(message.snapshot);
        break;
        
      case MessageType.PlayerJoined:
        console.log(`Player ${message.playerName} joined`);
        break;
        
      case MessageType.PlayerLeft:
        console.log(`Player left: ${message.playerId}`);
        break;
        
      case MessageType.Error:
        console.error(`Server error: ${message.message}`);
        break;
    }
  }
  
  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  joinRoom(roomId: string, playerName: string): void {
    const message: JoinRoomMessage = {
      type: MessageType.JoinRoom,
      roomId,
      playerName
    };
    this.send(message);
  }
  
  leaveRoom(): void {
    const message: LeaveRoomMessage = {
      type: MessageType.LeaveRoom
    };
    this.send(message);
  }
  
  sendInput(input: PlayerInput): void {
    const message: PlayerInputMessage = {
      type: MessageType.PlayerInput,
      input
    };
    this.send(message);
  }
}