import { World } from "../ecs/index.js";
import { Vector3, Hit } from "../types.js";

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

export interface ScriptContext {
  isClient: boolean;
  isServer: boolean;
  world: World;
  localPlayerId?: string;

  raycast(
    origin: Vector3,
    direction: Vector3,
    options?: RaycastOptions
  ): Hit | null;

  loadModel?(path: string): Promise<any>;
  loadAudio?(path: string): Promise<any>;

  db?: DatabaseAPI;

  broadcast?(message: any): void;
}

export type ScriptFunction = (ctx: ScriptContext) => void | Promise<void>;
