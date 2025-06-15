export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  position: Vector3;
  rotation: Quaternion;
  scale?: Vector3;
}

export interface PhysicsBody {
  position: Vector3;
  quaternion: Quaternion;
  velocity: Vector3;
  angularVelocity: Vector3;
  mass: number;
}

export interface Player {
  id: string;
  name: string;
  transform: Transform;
  velocity: Vector3;
  input: PlayerInput;
}

export interface PlayerInput {
  movement: Vector3;
  rotation: Quaternion;
  actions: Record<string, boolean>;
  timestamp: number;
  sequenceNumber: number;
}

export interface Snapshot {
  frameId: number;
  timestamp: number;
  players: Record<string, Player>;
  entities: Record<string, Transform>;
}

export interface Hit {
  point: Vector3;
  normal: Vector3;
  distance: number;
  entityId?: string;
  playerId?: string;
}
