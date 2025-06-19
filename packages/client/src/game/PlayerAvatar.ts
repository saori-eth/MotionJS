import * as THREE from 'three';
import { Player } from '@motionjs/common';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationManager } from './AnimationManager';
import { retargetAnimationFromUrl } from 'vrm-mixamo-retarget';

// We need to instantiate the loader only once.
const loader = new GLTFLoader();
loader.register((parser: any) => new VRMLoaderPlugin(parser));

export class PlayerAvatar {
  public vrm: VRM;
  private animationManager: AnimationManager;
  private targetPosition: THREE.Vector3;
  private currentPosition: THREE.Vector3;

  private constructor(
    player: Player,
    isLocal: boolean,
    vrm: VRM,
    animationManager: AnimationManager
  ) {
    this.vrm = vrm;
    this.vrm.scene.rotation.y = Math.PI; // Model may be facing backwards

    // Ensure all parts of the VRM avatar cast and receive shadows
    this.vrm.scene.traverse(obj => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });

    this.animationManager = animationManager;
    this.animationManager.play('idle');

    this.targetPosition = new THREE.Vector3(
      player.transform.position.x,
      player.transform.position.y,
      player.transform.position.z
    );

    this.currentPosition = this.targetPosition.clone();
    this.vrm.scene.position.copy(this.currentPosition);
  }

  public static async create(player: Player, isLocal: boolean): Promise<PlayerAvatar> {
    const gltf = await loader.loadAsync('/avatar.vrm');
    const vrm = gltf.userData.vrm as VRM;

    const animationManager = new AnimationManager(vrm);
    await animationManager.loadAndAddAnimation('idle', '/idle.fbx', vrm);
    await animationManager.loadAndAddAnimation('walk', '/walk.fbx', vrm);

    return new PlayerAvatar(player, isLocal, vrm, animationManager);
  }

  updateFromPlayer(player: Player, deltaTime: number): void {
    this.targetPosition.set(
      player.transform.position.x,
      player.transform.position.y,
      player.transform.position.z
    );

    const distance = this.currentPosition.distanceTo(this.targetPosition);

    // Play walk animation if moving, otherwise idle
    if (distance > 0.01) {
      this.animationManager.play('walk');
    } else {
      this.animationManager.play('idle');
    }

    this.currentPosition.lerp(this.targetPosition, Math.min(deltaTime * 10, 1));
    this.vrm.scene.position.copy(this.currentPosition);

    this.vrm.scene.quaternion.set(
      player.transform.rotation.x,
      player.transform.rotation.y,
      player.transform.rotation.z,
      player.transform.rotation.w
    );

    this.animationManager.update(deltaTime);
    this.vrm.update(deltaTime);
  }

  setPosition(x: number, y: number, z: number): void {
    this.targetPosition.set(x, y, z);
    this.currentPosition.copy(this.targetPosition);
    this.vrm.scene.position.copy(this.currentPosition);
  }

  dispose(): void {
    // VRM doesn't have a dispose method, but we can clean up the scene
    this.vrm.scene.traverse((obj) => {
      if ((obj as any).geometry) {
        (obj as any).geometry.dispose();
      }
      if ((obj as any).material) {
        const material = (obj as any).material;
        if (Array.isArray(material)) {
          material.forEach((mat) => mat.dispose());
        } else {
          material.dispose();
        }
      }
    });
  }
}
