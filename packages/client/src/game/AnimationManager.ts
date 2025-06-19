import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { retargetAnimationFromUrl } from 'vrm-mixamo-retarget';

export class AnimationManager {
  private mixer: THREE.AnimationMixer;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;

  constructor(vrm: VRM) {
    this.mixer = new THREE.AnimationMixer(vrm.scene);
  }

  public async loadAndAddAnimation(name: string, url: string, vrm: VRM) {
    const clip = await retargetAnimationFromUrl(url, vrm);
    if (!clip) {
      throw new Error(`Failed to load animation from ${url}`);
    }
    clip.name = name;
    const action = this.mixer.clipAction(clip);
    this.actions.set(name, action);
    return action;
  }

  public play(name: string) {
    if (this.currentAction?.getClip().name === name) return;

    const action = this.actions.get(name);
    if (!action) {
      console.warn(`Animation ${name} not found`);
      return;
    }

    const lastAction = this.currentAction;
    this.currentAction = action;

    if (lastAction) {
      this.currentAction.crossFadeFrom(lastAction, 0.2, true);
    }
    this.currentAction.play();
  }

  public update(delta: number) {
    this.mixer.update(delta);
  }
}
