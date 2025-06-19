import { defineQuery, defineSystem } from 'bitecs';
import { LocalPlayer, PhysicsBody } from '../components';
import { getPhysicsBody } from '../components/physicsBody';
import { ClientPhysicsWorld } from '../physics/ClientPhysicsWorld';
import { GameWorld } from '../world';

// Query for local player entities with physics bodies
const movableEntitiesQuery = defineQuery([LocalPlayer, PhysicsBody]);

export const createMovementSystem = () => {
  const physicsWorld = ClientPhysicsWorld.getInstance();
  
  return defineSystem((world: GameWorld) => {
    // Movement is now handled by physics system
    // This system is kept for compatibility but physics does the actual movement
    
    return world;
  });
};