import { PlayerInput, Snapshot, Vector3 } from './types.js';

export enum MessageType {
  // Client -> Server
  JoinRoom = 'JOIN_ROOM',
  LeaveRoom = 'LEAVE_ROOM',
  PlayerInput = 'PLAYER_INPUT',
  Ping = 'PING',
  
  // Server -> Client
  RoomJoined = 'ROOM_JOINED',
  RoomLeft = 'ROOM_LEFT',
  Snapshot = 'SNAPSHOT',
  PlayerJoined = 'PLAYER_JOINED',
  PlayerLeft = 'PLAYER_LEFT',
  Pong = 'PONG',
  Error = 'ERROR'
}

export interface JoinRoomMessage {
  type: MessageType.JoinRoom;
  roomId: string;
  playerName: string;
}

export interface LeaveRoomMessage {
  type: MessageType.LeaveRoom;
}

export interface PlayerInputMessage {
  type: MessageType.PlayerInput;
  input: PlayerInput;
}

export interface RoomJoinedMessage {
  type: MessageType.RoomJoined;
  playerId: string;
  roomId: string;
  maxPlayers: number;
  currentPlayers: number;
}

export interface SnapshotMessage {
  type: MessageType.Snapshot;
  snapshot: Snapshot;
}

export interface PlayerJoinedMessage {
  type: MessageType.PlayerJoined;
  playerId: string;
  playerName: string;
}

export interface PlayerLeftMessage {
  type: MessageType.PlayerLeft;
  playerId: string;
}

export interface ErrorMessage {
  type: MessageType.Error;
  code: string;
  message: string;
}

export type ClientMessage = JoinRoomMessage | LeaveRoomMessage | PlayerInputMessage;
export type ServerMessage = RoomJoinedMessage | SnapshotMessage | PlayerJoinedMessage | PlayerLeftMessage | ErrorMessage;