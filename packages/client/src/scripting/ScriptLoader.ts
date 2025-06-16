import {
  World,
  ScriptContext,
  ScriptFunction,
  Vector3,
} from "@motionjs/common";
import { Renderer } from "../rendering/Renderer";
import * as THREE from "three";

export class ScriptLoader {
  private scripts: Map<string, ScriptFunction> = new Map();
  private context: ScriptContext;
  private updateCallbacks: ((deltaTime: number) => void)[] = [];
  private lastUpdateTime: number = performance.now();

  constructor(private world: World, private renderer: Renderer) {
    this.context = this.createContext();
  }

  setLocalPlayerId(playerId: string): void {
    this.context.localPlayerId = playerId;
  }

  private createContext(): ScriptContext {
    return {
      isClient: true,
      isServer: false,
      world: this.world,
      localPlayerId: undefined,

      raycast: (origin: Vector3, direction: Vector3, options) => {
        const raycaster = new THREE.Raycaster();
        raycaster.set(
          new THREE.Vector3(origin.x, origin.y, origin.z),
          new THREE.Vector3(direction.x, direction.y, direction.z)
        );

        if (options?.maxDistance) {
          raycaster.far = options.maxDistance;
        }

        const intersects = raycaster.intersectObjects(
          this.renderer.scene.children,
          true
        );

        if (intersects.length > 0) {
          const hit = intersects[0];
          return {
            point: {
              x: hit.point.x,
              y: hit.point.y,
              z: hit.point.z,
            },
            normal: {
              x: hit.normal?.x || 0,
              y: hit.normal?.y || 0,
              z: hit.normal?.z || 0,
            },
            distance: hit.distance,
            entityId: hit.object.userData.entityId,
            playerId: hit.object.userData.playerId,
          };
        }

        return null;
      },

      loadModel: async (path: string) => {
        console.log(`Loading model: ${path}`);
        return null;
      },

      loadAudio: async (path: string) => {
        console.log(`Loading audio: ${path}`);
        return null;
      },

      onUpdate: (callback: (deltaTime: number) => void) => {
        this.updateCallbacks.push(callback);
      },
    };
  }

  async loadScripts(): Promise<void> {
    try {
      // Import all scripts from the scripts directory
      // @ts-ignore - Vite import.meta.glob
      const scriptModules = import.meta.glob("../../../../scripts/*.ts", {
        eager: false,
      });

      console.log("Found script modules:", Object.keys(scriptModules));

      for (const [path, importFn] of Object.entries(scriptModules)) {
        try {
          const module = (await importFn()) as any;
          if (module.default && typeof module.default === "function") {
            const scriptName =
              path.split("/").pop()?.replace(/\.ts$/, "") || "";
            this.scripts.set(scriptName, module.default);
            console.log(`Loaded client script: ${scriptName}`);

            // Execute the script immediately
            await module.default(this.context);
          }
        } catch (error) {
          console.error(`Failed to load script ${path}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to load scripts:", error);
    }
  }

  update(): void {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = currentTime;

    for (const callback of this.updateCallbacks) {
      try {
        callback(deltaTime);
      } catch (error) {
        console.error("Error in script update callback:", error);
      }
    }
  }
}
