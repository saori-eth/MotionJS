import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { World, ScriptContext, ScriptFunction, DatabaseAPI } from '@motionjs/common';
import { RoomManager } from '../rooms/RoomManager.js';
import { Database } from '../database/Database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ScriptLoader {
  private scripts: Map<string, ScriptFunction> = new Map();
  private roomUpdateCallbacks: Map<World, ((deltaTime: number) => void)[]> = new Map();
  private roomMessageHandlers: Map<World, Map<string, ((data: any, senderId?: string) => void)[]>> =
    new Map();
  private isReloading: boolean = false;
  private lastScriptVersion: number = 0;

  constructor(
    private roomManager: RoomManager,
    private database: Database
  ) {}

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
        console.log('Broadcasting:', message);
      },

      onUpdate: (callback: (deltaTime: number) => void) => {
        if (!this.roomUpdateCallbacks.has(world)) {
          this.roomUpdateCallbacks.set(world, []);
        }
        this.roomUpdateCallbacks.get(world)!.push(callback);
      },

      sendToClient: (channel: string, data: any, playerId?: string) => {
        // Get the room reference through roomManager
        const rooms = this.roomManager.getRooms();
        const room = rooms.find(r => r.world === world);
        if (room) {
          room.sendScriptMessage(channel, data, playerId);
        }
      },

      onMessage: (channel: string, callback: (data: any, senderId?: string) => void) => {
        if (!this.roomMessageHandlers.has(world)) {
          this.roomMessageHandlers.set(world, new Map());
        }
        const worldHandlers = this.roomMessageHandlers.get(world)!;
        if (!worldHandlers.has(channel)) {
          worldHandlers.set(channel, []);
        }
        worldHandlers.get(channel)!.push(callback);
      },
    };
  }

  async loadScripts(): Promise<void> {
    const scriptsDir = join(__dirname, '..', '..', '..', '..', 'scripts');

    try {
      // Prefer TypeScript index first, fall back to JavaScript
      const indexFiles = ['index.ts', 'index.js'];
      let found = false;

      for (const indexFile of indexFiles) {
        const scriptPath = join(scriptsDir, indexFile);
        try {
          await fs.access(scriptPath);
          const module = await import(scriptPath);

          if (module.default && typeof module.default === 'function') {
            const scriptName = indexFile.replace(/\.(ts|js)$/, '');
            this.scripts.set(scriptName, module.default);
            console.log(`Loaded server script: ${scriptName}`);

            // Execute script for each existing room immediately
            const rooms = this.roomManager.getRooms();
            for (const room of rooms) {
              const context = this.createContext(room.world);
              await module.default(context);
            }
            found = true;
            break; // Stop after first index file found
          } else {
            console.warn(`${indexFile} does not export a default function`);
          }
        } catch (err) {
          // Ignore if file doesn't exist, continue to next extension
        }
      }

      if (!found) {
        console.warn('No index script found in scripts directory. Skipping script loading.');
      }
    } catch (error) {
      console.log('Scripts directory not found, skipping script loading');
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
          console.error('Error in script update callback:', error);
        }
      }
    }
  }

  handleIncomingMessage(world: World, channel: string, data: any, senderId?: string): void {
    const worldHandlers = this.roomMessageHandlers.get(world);
    if (worldHandlers) {
      const handlers = worldHandlers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(data, senderId);
          } catch (error) {
            console.error(`Error in script message handler for channel ${channel}:`, error);
          }
        }
      }
    }
  }

  /**
   * Cleanly dispose script state for all rooms while preserving core room state
   */
  private disposeScriptState(): void {
    console.log('Disposing server script state...');

    // Clear update callbacks for all rooms
    this.roomUpdateCallbacks.clear();

    // Clear message handlers for all rooms
    this.roomMessageHandlers.clear();

    // Clear scripts
    this.scripts.clear();
  }

  /**
   * Reload scripts with cache busting while preserving room state
   */
  async reloadScripts(): Promise<void> {
    if (this.isReloading) {
      console.log('Script reload already in progress, skipping...');
      return;
    }

    this.isReloading = true;
    console.log('🔄 Reloading server scripts...');

    try {
      // Dispose script-specific state
      this.disposeScriptState();

      // Increment version for cache busting
      this.lastScriptVersion = Date.now();

      const scriptsDir = join(__dirname, '..', '..', '..', '..', 'scripts');

      // Clear module cache for the script files (cache busting handled by query param)
      const indexFiles = ['index.ts', 'index.js'];

      // Reload scripts using the existing loadScripts logic
      for (const indexFile of indexFiles) {
        const scriptPath = join(scriptsDir, indexFile);
        try {
          await fs.access(scriptPath);
          const module = await import(`${scriptPath}?t=${this.lastScriptVersion}`);

          if (module.default && typeof module.default === 'function') {
            const scriptName = indexFile.replace(/\.(ts|js)$/, '');
            this.scripts.set(scriptName, module.default);
            console.log(`✅ Reloaded server script: ${scriptName}`);

            // Execute script for each existing room immediately
            const rooms = this.roomManager.getRooms();
            for (const room of rooms) {
              const context = this.createContext(room.world);
              await module.default(context);
            }
            break;
          }
        } catch (err) {
          // Continue to next extension if file doesn't exist
        }
      }

      console.log('🎮 Server scripts reloaded successfully!');
    } catch (error) {
      console.error('❌ Failed to reload server scripts:', error);
    } finally {
      this.isReloading = false;
    }
  }

  /**
   * Check if scripts are currently reloading
   */
  isReloadingScripts(): boolean {
    return this.isReloading;
  }
}
