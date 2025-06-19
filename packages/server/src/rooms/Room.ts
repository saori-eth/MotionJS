import {
  World,
  Player,
  PlayerInput,
  Snapshot,
  MessageType,
  RoomJoinedMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  SnapshotMessage,
  ScriptBroadcastMessage,
  Vector3,
} from '@motionjs/common';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { ClientConnection } from '../networking/ClientConnection.js';
import { Database } from '../database/Database.js';
import { ScriptLoader } from '../scripting/ScriptLoader.js';

export interface RoomConfig {
  maxPlayers: number;
  tickRate: number;
}

export class Room {
  public readonly world: World;
  private physics: PhysicsWorld;
  private players: Map<string, Player> = new Map();
  private connections: Map<string, ClientConnection> = new Map();
  private frameId: number = 0;
  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = Date.now();
  private scriptLoader: ScriptLoader | null = null;

  constructor(
    public readonly id: string,
    private config: RoomConfig,
    private database: Database
  ) {
    this.world = new World();
    this.physics = new PhysicsWorld();
  }

  setScriptLoader(scriptLoader: ScriptLoader): void {
    this.scriptLoader = scriptLoader;
  }

  start(): void {
    const tickMs = 1000 / this.config.tickRate;
    this.tickInterval = setInterval(() => this.tick(), tickMs);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  addPlayer(
    connectionId: string,
    playerName: string,
    connection: ClientConnection,
    spawnPosition?: Vector3
  ): { success: boolean; playerId?: string; error?: string } {
    if (this.players.size >= this.config.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }

    const playerId = this.database.createUser(playerName);
    const body = this.physics.createPlayerBody(playerId);

    const player: Player = {
      id: playerId,
      name: playerName,
      transform: {
        position: spawnPosition ?? {
          x: body.position.x,
          y: body.position.y,
          z: body.position.z,
        },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      },
      velocity: { x: 0, y: 0, z: 0 },
      input: {
        movement: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        actions: {},
        timestamp: Date.now(),
        sequenceNumber: 0,
      },
    };

    this.players.set(playerId, player);
    this.connections.set(playerId, connection);

    const joinedMessage: RoomJoinedMessage = {
      type: MessageType.RoomJoined,
      playerId,
      roomId: this.id,
      maxPlayers: this.config.maxPlayers,
      currentPlayers: this.players.size,
    };
    connection.send(joinedMessage);

    const playerJoinedMessage: PlayerJoinedMessage = {
      type: MessageType.PlayerJoined,
      playerId,
      playerName,
    };
    this.broadcast(playerJoinedMessage, playerId);

    if (!this.tickInterval) {
      this.start();
    }

    // Send immediate snapshot to new player
    this.sendSnapshotToPlayer(playerId);

    if (spawnPosition) {
      // Teleport physics body to provided position
      body.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
      body.velocity.set(0, 0, 0);
    }

    return { success: true, playerId };
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.connections.delete(playerId);
    this.physics.removePlayerBody(playerId);

    const playerLeftMessage: PlayerLeftMessage = {
      type: MessageType.PlayerLeft,
      playerId,
    };
    this.broadcast(playerLeftMessage);

    if (this.players.size === 0) {
      this.stop();
    }
  }

  handlePlayerInput(playerId: string, input: PlayerInput): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.input = input;

    // Movement vector already contains jump information in y component
    this.physics.applyPlayerInput(playerId, input.movement);
  }

  private tick(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    this.physics.step(deltaTime);

    for (const [playerId, player] of this.players) {
      const physicsBody = this.physics.getPlayerPhysics(playerId);
      if (physicsBody) {
        player.transform.position = physicsBody.position;
        player.transform.rotation = physicsBody.quaternion;
        player.velocity = physicsBody.velocity;
      }
    }

    // Update scripts
    if (this.scriptLoader) {
      this.scriptLoader.updateRoom(this.world, deltaTime);
    }

    const snapshot: Snapshot = {
      frameId: this.frameId++,
      timestamp: now,
      players: Object.fromEntries(this.players),
      entities: {},
    };

    const snapshotMessage: SnapshotMessage = {
      type: MessageType.Snapshot,
      snapshot,
    };

    this.broadcast(snapshotMessage);
  }

  private broadcast(message: any, excludePlayerId?: string): void {
    for (const [playerId, connection] of this.connections) {
      if (playerId !== excludePlayerId) {
        connection.send(message);
      }
    }
  }

  private sendSnapshotToPlayer(playerId: string): void {
    const connection = this.connections.get(playerId);
    if (!connection) return;

    const snapshot: Snapshot = {
      frameId: this.frameId,
      timestamp: Date.now(),
      players: Object.fromEntries(this.players),
      entities: {},
    };

    const snapshotMessage: SnapshotMessage = {
      type: MessageType.Snapshot,
      snapshot,
    };

    connection.send(snapshotMessage);
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  isAvailable(): boolean {
    return this.players.size < this.config.maxPlayers;
  }

  handleScriptMessage(senderId: string, channel: string, data: any, targetPlayerId?: string): void {
    if (this.scriptLoader) {
      this.scriptLoader.handleIncomingMessage(this.world, channel, data, senderId);
    }

    const broadcastMessage: ScriptBroadcastMessage = {
      type: MessageType.ScriptBroadcast,
      channel,
      data,
      senderId,
    };

    if (targetPlayerId) {
      // Send to specific player
      const connection = this.connections.get(targetPlayerId);
      if (connection) {
        connection.send(broadcastMessage);
      }
    } else {
      // Broadcast to all players except sender
      this.broadcast(broadcastMessage, senderId);
    }
  }

  sendScriptMessage(channel: string, data: any, targetPlayerId?: string): void {
    const broadcastMessage: ScriptBroadcastMessage = {
      type: MessageType.ScriptBroadcast,
      channel,
      data,
    };

    if (targetPlayerId) {
      const connection = this.connections.get(targetPlayerId);
      if (connection) {
        connection.send(broadcastMessage);
      }
    } else {
      this.broadcast(broadcastMessage);
    }
  }
}
