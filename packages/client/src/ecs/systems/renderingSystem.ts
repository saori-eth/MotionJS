import { defineQuery, defineSystem } from 'bitecs';
import { Position, Rotation, Renderable } from '../components';
import { getRenderableObject } from '../components/renderable';
import { GameWorld } from '../world';
import * as THREE from 'three';

// Query for entities with position, rotation, and renderable components
const renderableEntitiesQuery = defineQuery([Position, Rotation, Renderable]);

export const createRenderingSystem = () => {
  return defineSystem((world: GameWorld) => {
    const entities = renderableEntitiesQuery(world);
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      // Get the Three.js object
      const meshId = Renderable.meshId[entity];
      const object = getRenderableObject(meshId);
      
      if (object) {
        // Update position
        object.position.set(
          Position.x[entity],
          Position.y[entity],
          Position.z[entity]
        );
        
        // Update rotation (quaternion)
        object.quaternion.set(
          Rotation.x[entity],
          Rotation.y[entity],
          Rotation.z[entity],
          Rotation.w[entity]
        );
      }
    }
    
    return world;
  });
};