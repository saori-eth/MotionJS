import { defineQuery, defineSystem } from 'bitecs';
import { Position, LocalPlayer } from '../components';
import { GameWorld } from '../world';
import * as THREE from 'three';

// Camera configuration
const CAMERA_OFFSET = new THREE.Vector3(0, 4, 6);
const LOOK_AT_OFFSET = new THREE.Vector3(0, 1, 0);
const SMOOTHNESS = 0.1;

// Temporary vectors to avoid allocations
const desiredPosition = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();
const targetPosition = new THREE.Vector3();

// Query for local player entity
const localPlayerQuery = defineQuery([Position, LocalPlayer]);

export const createCameraSystem = (camera: THREE.Camera) => {
  return defineSystem((world: GameWorld) => {
    const entities = localPlayerQuery(world);
    
    // Should only have one local player
    if (entities.length > 0) {
      const entity = entities[0];
      
      // Get player position
      targetPosition.set(
        Position.x[entity],
        Position.y[entity],
        Position.z[entity]
      );
      
      // Calculate desired camera position
      desiredPosition.copy(targetPosition).add(CAMERA_OFFSET);
      
      // Calculate look at position
      desiredLookAt.copy(targetPosition).add(LOOK_AT_OFFSET);
      
      // Smoothly move camera
      camera.position.lerp(desiredPosition, SMOOTHNESS);
      camera.lookAt(desiredLookAt);
    }
    
    return world;
  });
};