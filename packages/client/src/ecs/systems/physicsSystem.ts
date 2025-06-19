import { defineQuery, defineSystem, enterQuery, exitQuery } from 'bitecs';
import { Position, Rotation, Velocity, PhysicsBody, LocalPlayer } from '../components';
import { getPhysicsBody } from '../components/physicsBody';
import { ClientPhysicsWorld } from '../physics/ClientPhysicsWorld';
import { GameWorld } from '../world';

// Query for entities with physics bodies
const physicsEntitiesQuery = defineQuery([Position, Rotation, Velocity, PhysicsBody]);
const physicsEntitiesEnterQuery = enterQuery(physicsEntitiesQuery);
const physicsEntitiesExitQuery = exitQuery(physicsEntitiesQuery);

export const createPhysicsSystem = () => {
  const physicsWorld = ClientPhysicsWorld.getInstance();
  
  return defineSystem((world: GameWorld) => {
    // Handle new physics entities
    const entered = physicsEntitiesEnterQuery(world);
    for (let i = 0; i < entered.length; i++) {
      const entity = entered[i];
      // Physics body should already be created by the entity factory
    }

    // Handle removed physics entities
    const exited = physicsEntitiesExitQuery(world);
    for (let i = 0; i < exited.length; i++) {
      const entity = exited[i];
      physicsWorld.removePlayerBody(entity);
    }

    // Step the physics simulation
    physicsWorld.step(world.time.delta);

    // Update ECS components from physics bodies
    const entities = physicsEntitiesQuery(world);
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const bodyId = PhysicsBody.bodyId[entity];
      const body = getPhysicsBody(bodyId);
      
      if (body) {
        // For non-local players, physics is just for collision detection
        // Their positions are set by interpolation/network updates
        if (!hasComponent(world, LocalPlayer, entity)) {
          // Set physics body position from ECS (driven by interpolation)
          body.position.x = Position.x[entity];
          body.position.y = Position.y[entity];
          body.position.z = Position.z[entity];
          
          body.quaternion.x = Rotation.x[entity];
          body.quaternion.y = Rotation.y[entity];
          body.quaternion.z = Rotation.z[entity];
          body.quaternion.w = Rotation.w[entity];
        } else {
          // For local player, update ECS from physics
          Position.x[entity] = body.position.x;
          Position.y[entity] = body.position.y;
          Position.z[entity] = body.position.z;
          
          Rotation.x[entity] = body.quaternion.x;
          Rotation.y[entity] = body.quaternion.y;
          Rotation.z[entity] = body.quaternion.z;
          Rotation.w[entity] = body.quaternion.w;
          
          // Update velocity from physics
          Velocity.x[entity] = body.velocity.x;
          Velocity.y[entity] = body.velocity.y;
          Velocity.z[entity] = body.velocity.z;
        }
      }
    }

    return world;
  });
};

// Import to check if entity has LocalPlayer component
import { hasComponent } from 'bitecs';