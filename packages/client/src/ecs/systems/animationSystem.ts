import { defineQuery, defineSystem, enterQuery } from 'bitecs';
import { Velocity, Renderable, AnimationState, AnimationMixer, AnimationStates } from '../components';
import { getAnimationMixer } from '../components/animationMixer';
import { getRenderableObject } from '../components/renderable';
import { GameWorld } from '../world';
import { VRM } from '@pixiv/three-vrm';
import { mixamoVRMRigMap } from 'vrm-mixamo-retarget';
import * as THREE from 'three';

// Animation URLs
const ANIMATION_URLS = {
  idle: '/idle.fbx',
  walk: '/walk.fbx',
};

// Query for entities with animation components
const animatedEntitiesQuery = defineQuery([Velocity, Renderable, AnimationState, AnimationMixer]);
const animatedEntitiesEnterQuery = enterQuery(animatedEntitiesQuery);

// Cache for loaded animations
const animationCache = new Map<string, THREE.AnimationClip>();

async function loadAnimation(url: string, vrm: VRM): Promise<THREE.AnimationClip | null> {
  // Check cache first
  const cacheKey = `${url}-${vrm.scene.uuid}`;
  if (animationCache.has(cacheKey)) {
    return animationCache.get(cacheKey)!;
  }

  try {
    const { retargetAnimationFromUrl } = await import('vrm-mixamo-retarget');
    const clip = await retargetAnimationFromUrl(url, vrm);
    if (clip) {
      animationCache.set(cacheKey, clip);
    }
    return clip;
  } catch (error) {
    console.error(`Failed to load animation ${url}:`, error);
    return null;
  }
}

export const createAnimationSystem = () => {
  return defineSystem((world: GameWorld) => {
    // Wrap async logic in an IIFE to maintain sync system signature
    (async () => {
    // Handle new animated entities
    const entered = animatedEntitiesEnterQuery(world);
    for (let i = 0; i < entered.length; i++) {
      const entity = entered[i];
      const mixerId = AnimationMixer.mixerId[entity];
      const mixerInstance = getAnimationMixer(mixerId);
      
      if (mixerInstance) {
        // Load initial animations
        const meshId = Renderable.meshId[entity];
        const object = getRenderableObject(meshId);
        
        if (object) {
          // Check if it's a VRM
          const vrm = (object as any).vrm as VRM | undefined;
          if (vrm) {
            // Load idle and walk animations
            const idleClip = await loadAnimation(ANIMATION_URLS.idle, vrm);
            const walkClip = await loadAnimation(ANIMATION_URLS.walk, vrm);
            
            if (idleClip) {
              const idleAction = mixerInstance.mixer.clipAction(idleClip);
              mixerInstance.actions.set('idle', idleAction);
            }
            
            if (walkClip) {
              const walkAction = mixerInstance.mixer.clipAction(walkClip);
              mixerInstance.actions.set('walk', walkAction);
            }
            
            // Start with idle
            const idleAction = mixerInstance.actions.get('idle');
            if (idleAction) {
              idleAction.play();
              mixerInstance.currentAction = idleAction;
            }
          }
        }
      }
    }

    // Update animation states
    const entities = animatedEntitiesQuery(world);
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      // Calculate movement speed
      const vx = Velocity.x[entity];
      const vz = Velocity.z[entity];
      const speed = Math.sqrt(vx * vx + vz * vz);
      
      // Determine target animation state
      const currentState = AnimationState.currentState[entity];
      let targetState = AnimationStates.IDLE;
      
      if (speed > 0.1) {
        targetState = AnimationStates.WALK as any; // Cast to any to avoid TS strict literal type checking
      }
      
      // Handle state transitions
      if (targetState !== currentState) {
        AnimationState.previousState[entity] = currentState;
        AnimationState.currentState[entity] = targetState;
        AnimationState.transitionTime[entity] = 0.2; // 200ms transition
        
        // Play the appropriate animation
        const mixerId = AnimationMixer.mixerId[entity];
        const mixerInstance = getAnimationMixer(mixerId);
        
        if (mixerInstance) {
          const targetAnimName = targetState === (AnimationStates.WALK as any) ? 'walk' : 'idle';
          const targetAction = mixerInstance.actions.get(targetAnimName);
          
          if (targetAction && targetAction !== mixerInstance.currentAction) {
            // Crossfade to new animation
            if (mixerInstance.currentAction) {
              targetAction.reset();
              targetAction.play();
              mixerInstance.currentAction.crossFadeTo(targetAction, 0.2, true);
            } else {
              targetAction.play();
            }
            mixerInstance.currentAction = targetAction;
          }
        }
      }
      
      // Update transition time
      if (AnimationState.transitionTime[entity] > 0) {
        AnimationState.transitionTime[entity] -= world.time.delta;
      }
      
      // Update animation mixer
      const mixerId = AnimationMixer.mixerId[entity];
      const mixerInstance = getAnimationMixer(mixerId);
      
      if (mixerInstance) {
        mixerInstance.mixer.update(world.time.delta);
        
        // Update VRM if present
        const meshId = Renderable.meshId[entity];
        const object = getRenderableObject(meshId);
        
        if (object) {
          const vrm = (object as any).vrm as VRM | undefined;
          if (vrm) {
            vrm.update(world.time.delta);
          }
        }
      }
    }
    })(); // End async IIFE

    return world;
  });
};