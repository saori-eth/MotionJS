import {
  ClientMessage,
  ServerMessage,
  MessageType,
  PlayerInput,
  JoinRoomMessage,
  LeaveRoomMessage,
  PlayerInputMessage,
  ScriptMessage,
  ScriptBroadcastMessage,
  Vector3,
} from "@motionjs/common";
import { useGameStore } from "../store/gameStore";

export class NetworkManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectDelay = 300; // start with 300ms for rapid first reconnect
  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 5000;
  private scriptMessageHandlers: Map<
    string,
    ((data: any, senderId?: string) => void)[]
  > = new Map();
  private lastRoomId: string | undefined = undefined;
  private lastPlayerName: string | undefined = undefined;
  private lastSpawnPosition: Vector3 | undefined;

  constructor(private serverUrl: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log("Connected to server");
          useGameStore.getState().setConnected(true);
          // Reset reconnect attempts & delay after successful connection
          this.reconnectAttempts = 0;
          this.reconnectDelay = 300;

          if (this.lastPlayerName) {
            console.log("Rejoining room after reconnect...", {
              roomId: this.lastRoomId,
              playerName: this.lastPlayerName,
              spawnPosition: this.lastSpawnPosition,
            });
            this.joinRoom(
              this.lastRoomId,
              this.lastPlayerName,
              this.lastSpawnPosition
            );
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("Failed to parse message:", error);
          }
        };

        this.ws.onclose = () => {
          console.log("Disconnected from server");
          useGameStore.getState().setConnected(false);
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
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

    // Exponential backoff for next attempt
    this.reconnectAttempts += 1;
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay
    );
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

      case MessageType.ScriptBroadcast:
        this.handleScriptBroadcast(message);
        break;
    }
  }

  private handleScriptBroadcast(message: ScriptBroadcastMessage): void {
    const handlers = this.scriptMessageHandlers.get(message.channel);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message.data, message.senderId);
        } catch (error) {
          console.error(
            `Error in script message handler for channel ${message.channel}:`,
            error
          );
        }
      }
    }
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("Cannot send message - WebSocket not open:", {
        readyState: this.ws?.readyState,
        message: message.type,
      });
    }
  }

  joinRoom(
    roomId: string | undefined,
    playerName: string,
    spawnPosition?: Vector3
  ): void {
    this.lastRoomId = roomId;
    this.lastPlayerName = playerName;
    if (spawnPosition) {
      this.lastSpawnPosition = spawnPosition;
    }
    const message: JoinRoomMessage = {
      type: MessageType.JoinRoom,
      roomId,
      playerName,
      spawnPosition: spawnPosition ?? this.lastSpawnPosition,
    };
    this.send(message);
  }

  leaveRoom(): void {
    const message: LeaveRoomMessage = {
      type: MessageType.LeaveRoom,
    };
    this.send(message);
  }

  sendInput(input: PlayerInput): void {
    const message: PlayerInputMessage = {
      type: MessageType.PlayerInput,
      input,
    };
    this.send(message);
  }

  sendScriptMessage(channel: string, data: any, targetPlayerId?: string): void {
    const message: ScriptMessage = {
      type: MessageType.ScriptMessage,
      channel,
      data,
      targetPlayerId,
    };
    this.send(message);
  }

  onScriptMessage(
    channel: string,
    handler: (data: any, senderId?: string) => void
  ): void {
    if (!this.scriptMessageHandlers.has(channel)) {
      this.scriptMessageHandlers.set(channel, []);
    }
    this.scriptMessageHandlers.get(channel)!.push(handler);
  }

  offScriptMessage(
    channel: string,
    handler: (data: any, senderId?: string) => void
  ): void {
    const handlers = this.scriptMessageHandlers.get(channel);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  setSpawnPosition(position: Vector3): void {
    this.lastSpawnPosition = position;
  }
}
