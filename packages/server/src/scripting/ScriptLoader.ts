import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  World,
  ScriptContext,
  ScriptFunction,
  DatabaseAPI,
} from "@motionjs/common";
import { RoomManager } from "../rooms/RoomManager.js";
import { Database } from "../database/Database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ScriptLoader {
  private scripts: Map<string, ScriptFunction> = new Map();
  private roomUpdateCallbacks: Map<World, ((deltaTime: number) => void)[]> = new Map();

  constructor(private roomManager: RoomManager, private database: Database) {}

  private createContext(world: World): ScriptContext {
    const dbApi: DatabaseAPI = {
      addCurrency: async (userId: string, amount: number) => {
        this.database.addCurrency(userId, amount);
      },
      getCurrency: async (userId: string) => {
        return this.database.getCurrency(userId);
      },
      getUser: async (userId: string) => {
        return this.database.getUser(userId);
      },
    };

    return {
      isClient: false,
      isServer: true,
      world,

      raycast: (origin, direction, options) => {
        const rooms = this.roomManager.getRooms();
        for (const room of rooms) {
          // Room would need to expose physics raycast
        }
        return null;
      },

      db: dbApi,

      broadcast: (message: any) => {
        console.log("Broadcasting:", message);
      },

      onUpdate: (callback: (deltaTime: number) => void) => {
        if (!this.roomUpdateCallbacks.has(world)) {
          this.roomUpdateCallbacks.set(world, []);
        }
        this.roomUpdateCallbacks.get(world)!.push(callback);
      },
    };
  }

  async loadScripts(): Promise<void> {
    const scriptsDir = join(__dirname, "..", "..", "..", "..", "scripts");

    try {
      await fs.access(scriptsDir);
      const files = await fs.readdir(scriptsDir);

      for (const file of files) {
        if (file.endsWith(".ts") || file.endsWith(".js")) {
          try {
            const scriptPath = join(scriptsDir, file);
            const module = await import(scriptPath);

            if (module.default && typeof module.default === "function") {
              const scriptName = file.replace(/\\.(ts|js)$/, "");
              this.scripts.set(scriptName, module.default);
              console.log(`Loaded server script: ${scriptName}`);

              // Execute scripts for each room
              const rooms = this.roomManager.getRooms();
              for (const room of rooms) {
                const context = this.createContext(room.world);
                await module.default(context);
              }
            }
          } catch (error) {
            console.error(`Failed to load script ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.log("Scripts directory not found, skipping script loading");
    }
  }

  async executeScriptsForRoom(world: World): Promise<void> {
    const context = this.createContext(world);
    for (const [name, script] of this.scripts) {
      try {
        await script(context);
        console.log(`Executed script ${name} for room`);
      } catch (error) {
        console.error(`Failed to execute script ${name}:`, error);
      }
    }
  }

  updateRoom(world: World, deltaTime: number): void {
    const callbacks = this.roomUpdateCallbacks.get(world);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(deltaTime);
        } catch (error) {
          console.error("Error in script update callback:", error);
        }
      }
    }
  }
}
