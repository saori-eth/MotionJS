import { World } from '../ecs/index.js';
import { Vector3, Hit } from '../types.js';

export interface RaycastOptions {
  maxDistance?: number;
  ignorePlayer?: boolean;
  layers?: number;
}

export interface DatabaseAPI {
  addCurrency(userId: string, amount: number): Promise<void>;
  getCurrency(userId: string): Promise<number>;
  getUser(userId: string): Promise<{ id: string; name: string } | null>;
}

export interface PrimitiveOptions {
  type: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane';
  position?: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
  color?: number;
  wireframe?: boolean;
}

export interface SpawnedPrimitive {
  id: string;
  mesh: any; // THREE.Mesh
  setPosition(position: Vector3): void;
  setRotation(rotation: Vector3): void;
  setScale(scale: Vector3): void;
  destroy(): void;
}

export interface ScriptContext {
  isClient: boolean;
  isServer: boolean;
  world: World;
  localPlayerId?: string;

  raycast(origin: Vector3, direction: Vector3, options?: RaycastOptions): Hit | null;

  loadModel?(path: string): Promise<any>;
  loadAudio?(path: string): Promise<any>;

  db?: DatabaseAPI;

  broadcast?(message: any): void;

  onUpdate(callback: (deltaTime: number) => void): void;

  spawnPrimitive?(options: PrimitiveOptions): SpawnedPrimitive;

  // Messaging API
  sendToServer?(channel: string, data: any): void;
  sendToClient?(channel: string, data: any, playerId?: string): void;
  onMessage(channel: string, callback: (data: any, senderId?: string) => void): void;
}

export type ScriptFunction = (ctx: ScriptContext) => void | Promise<void>;
