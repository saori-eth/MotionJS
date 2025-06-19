import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Player } from '@motionjs/common';
import * as THREE from 'three';

// Temporary PlayerAvatar class for ECS migration
export class PlayerAvatar {
  constructor(public vrm: VRM) {}

  static async create(player: Player, isLocal: boolean): Promise<PlayerAvatar> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await loader.loadAsync('/avatar.vrm');
    const vrm = gltf.userData.vrm as VRM;
    
    // Set initial position
    vrm.scene.position.set(
      player.transform.position.x,
      player.transform.position.y,
      player.transform.position.z
    );
    
    // Set initial rotation
    vrm.scene.quaternion.set(
      player.transform.rotation.x,
      player.transform.rotation.y,
      player.transform.rotation.z,
      player.transform.rotation.w
    );

    return new PlayerAvatar(vrm);
  }

  dispose(): void {
    this.vrm.scene.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m: any) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}