import { World, ScriptContext, ScriptFunction, Vector3, Hit } from '@motionjs/common';
import { Renderer } from '../rendering/Renderer';
import * as THREE from 'three';

export class ScriptLoader {
  private scripts: Map<string, ScriptFunction> = new Map();
  private context: ScriptContext;
  
  constructor(private world: World, private renderer: Renderer) {
    this.context = this.createContext();
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
              z: hit.point.z
            },
            normal: {
              x: hit.normal?.x || 0,
              y: hit.normal?.y || 0,
              z: hit.normal?.z || 0
            },
            distance: hit.distance,
            entityId: hit.object.userData.entityId,
            playerId: hit.object.userData.playerId
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
      }
    };
  }
  
  async loadScripts(): Promise<void> {
    try {
      // For now, skip script loading on client until we set up proper script bundling
      console.log('Client script loading not yet implemented');
    } catch (error) {
      console.error('Failed to load scripts:', error);
    }
  }
}