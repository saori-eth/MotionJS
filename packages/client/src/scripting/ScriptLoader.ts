import {
  World,
  ScriptContext,
  ScriptFunction,
  Vector3,
  PrimitiveOptions,
  SpawnedPrimitive,
} from "@motionjs/common";
import { Renderer } from "../rendering/Renderer";
import * as THREE from "three";

export class ScriptLoader {
  private scripts: Map<string, ScriptFunction> = new Map();
  private context: ScriptContext;
  private updateCallbacks: ((deltaTime: number) => void)[] = [];
  private lastUpdateTime: number = performance.now();
  private spawnedPrimitives: Map<string, THREE.Mesh> = new Map();
  private primitiveIdCounter: number = 0;
  private messageHandlers: Map<
    string,
    ((data: any, senderId?: string) => void)[]
  > = new Map();
  private networkManager: any = null;

  constructor(private world: World, private renderer: Renderer) {
    this.context = this.createContext();
  }

  setNetworkManager(networkManager: any): void {
    this.networkManager = networkManager;
    // Re-register all message handlers with the network manager
    for (const [channel, handlers] of this.messageHandlers) {
      for (const handler of handlers) {
        this.networkManager.onScriptMessage(channel, handler);
      }
    }
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

      spawnPrimitive: (options: PrimitiveOptions): SpawnedPrimitive => {
        const id = `primitive_${this.primitiveIdCounter++}`;

        // Create geometry based on type
        let geometry: THREE.BufferGeometry;
        switch (options.type) {
          case "box":
            geometry = new THREE.BoxGeometry(1, 1, 1);
            break;
          case "sphere":
            geometry = new THREE.SphereGeometry(0.5, 32, 16);
            break;
          case "cylinder":
            geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
            break;
          case "cone":
            geometry = new THREE.ConeGeometry(0.5, 1, 32);
            break;
          case "torus":
            geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
            break;
          case "plane":
            geometry = new THREE.PlaneGeometry(1, 1);
            break;
        }

        // Create material
        const material = new THREE.MeshPhongMaterial({
          color: options.color ?? 0x00ff00,
          wireframe: options.wireframe ?? false,
        });

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);

        // Set initial transform
        if (options.position) {
          mesh.position.set(
            options.position.x,
            options.position.y,
            options.position.z
          );
        }
        if (options.rotation) {
          mesh.rotation.set(
            options.rotation.x,
            options.rotation.y,
            options.rotation.z
          );
        }
        if (options.scale) {
          mesh.scale.set(options.scale.x, options.scale.y, options.scale.z);
        }

        // Add to scene
        this.renderer.scene.add(mesh);
        this.spawnedPrimitives.set(id, mesh);

        // Return primitive controller
        return {
          id,
          mesh,
          setPosition: (position: Vector3) => {
            mesh.position.set(position.x, position.y, position.z);
          },
          setRotation: (rotation: Vector3) => {
            mesh.rotation.set(rotation.x, rotation.y, rotation.z);
          },
          setScale: (scale: Vector3) => {
            mesh.scale.set(scale.x, scale.y, scale.z);
          },
          destroy: () => {
            this.renderer.scene.remove(mesh);
            geometry.dispose();
            material.dispose();
            this.spawnedPrimitives.delete(id);
          },
        };
      },

      sendToServer: (channel: string, data: any) => {
        if (this.networkManager) {
          this.networkManager.sendScriptMessage(channel, data);
        } else {
          console.warn("NetworkManager not set, cannot send message to server");
        }
      },

      onMessage: (
        channel: string,
        callback: (data: any, senderId?: string) => void
      ) => {
        if (!this.messageHandlers.has(channel)) {
          this.messageHandlers.set(channel, []);
        }
        this.messageHandlers.get(channel)!.push(callback);

        // Register with network manager if available
        if (this.networkManager) {
          this.networkManager.onScriptMessage(channel, callback);
        }
      },
    };
  }

  async loadScripts(): Promise<void> {
    try {
      // Dynamically import only the entry script (index.ts) from the scripts directory
      const module: any = await import(
        /* @vite-ignore */ "../../../../scripts/index.ts"
      );

      if (module.default && typeof module.default === "function") {
        const scriptName = "index";
        this.scripts.set(scriptName, module.default);
        console.log(`Loaded client script: ${scriptName}`);

        // Execute the script immediately
        await module.default(this.context);
      } else {
        console.warn(
          "scripts/index.ts does not have a default export function to execute"
        );
      }
    } catch (error) {
      console.error("Failed to load scripts/index.ts:", error);
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

  dispose(): void {
    // Clean up spawned primitives
    for (const [id, mesh] of this.spawnedPrimitives) {
      this.renderer.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
    this.spawnedPrimitives.clear();
    this.updateCallbacks = [];

    // Unregister message handlers
    if (this.networkManager) {
      for (const [channel, handlers] of this.messageHandlers) {
        for (const handler of handlers) {
          this.networkManager.offScriptMessage(channel, handler);
        }
      }
    }
    this.messageHandlers.clear();
  }
}
