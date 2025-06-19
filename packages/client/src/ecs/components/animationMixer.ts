import { defineComponent, Types } from 'bitecs';
import * as THREE from 'three';

export const AnimationMixer = defineComponent({
  mixerId: Types.ui32
});

// Store actual mixer instances and actions
export const mixerInstances = new Map<number, {
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  currentAction: THREE.AnimationAction | null;
}>();

let nextMixerId = 1;

export function createAnimationMixer(object: THREE.Object3D): number {
  const mixerId = nextMixerId++;
  const mixer = new THREE.AnimationMixer(object);
  
  mixerInstances.set(mixerId, {
    mixer,
    actions: new Map(),
    currentAction: null
  });
  
  return mixerId;
}

export function getAnimationMixer(mixerId: number) {
  return mixerInstances.get(mixerId);
}

export function removeAnimationMixer(mixerId: number): void {
  const instance = mixerInstances.get(mixerId);
  if (instance) {
    instance.mixer.stopAllAction();
    mixerInstances.delete(mixerId);
  }
}