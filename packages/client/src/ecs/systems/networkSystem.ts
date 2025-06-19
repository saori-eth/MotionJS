import { defineSystem, addEntity, removeEntity, hasComponent, addComponent } from 'bitecs';
import { GameWorld } from '../world';
import { NetworkManager } from '../../networking/NetworkManager';
import { useGameStore } from '../../store/gameStore';
import { createPlayerEntity } from '../entities/player';
import { PlayerAvatar } from '../../game/PlayerAvatar';
import { 
  Player, 
  Position, 
  Rotation, 
  Velocity,
  LocalPlayer,
  InterpolationTarget,
  Renderable,
  AnimationState,
  AnimationMixer,
  PhysicsBody,
  getStringPlayerId,
  getOrCreateNumericPlayerId
} from '../components';
import { createRenderableId } from '../components/renderable';
import { createAnimationMixer } from '../components/animationMixer';
import { createPhysicsBody, removePhysicsBody } from '../components/physicsBody';
import { ClientPhysicsWorld } from '../physics/ClientPhysicsWorld';

// Map server player IDs to ECS entities
const playerEntityMap = new Map<string, number>();
const entityPlayerMap = new Map<number, string>();

// Temporary avatar creation tracking
const avatarsBeingCreated = new Set<string>();

export const createNetworkSystem = (networkManager: NetworkManager, renderer: any) => {
  let isUpdatingFromSnapshot = false;
  
  return defineSystem((world: GameWorld) => {
    // Wrap async logic in an IIFE to maintain sync system signature
    (async () => {
    const store = useGameStore.getState();
    
    // Skip if we're already updating or no snapshot
    if (isUpdatingFromSnapshot || !store.latestSnapshot) {
      return;
    }
    
    isUpdatingFromSnapshot = true;
    
    try {
      const snapshot = store.latestSnapshot;
      
      // Create entities for new players
      for (const [playerId, player] of store.players) {
        if (!playerEntityMap.has(playerId) && !avatarsBeingCreated.has(playerId)) {
          avatarsBeingCreated.add(playerId);
          
          try {
            const isLocal = playerId === store.playerId;
            
            // Create avatar (this is temporary - will be replaced with pure ECS later)
            const avatar = await PlayerAvatar.create(player, isLocal);
            
            // Create ECS entity
            const entity = addEntity(world);
            
            // Map player ID to entity
            playerEntityMap.set(playerId, entity);
            entityPlayerMap.set(entity, playerId);
            
            // Add components
            addComponent(world, Player, entity);
            addComponent(world, Position, entity);
            addComponent(world, Rotation, entity);
            addComponent(world, Velocity, entity);
            addComponent(world, Renderable, entity);
            addComponent(world, AnimationState, entity);
            addComponent(world, AnimationMixer, entity);
            addComponent(world, PhysicsBody, entity);
            
            // Set player ID
            const numericId = getOrCreateNumericPlayerId(playerId);
            Player.id[entity] = numericId;
            
            // Set initial transform
            Position.x[entity] = player.transform.position.x;
            Position.y[entity] = player.transform.position.y;
            Position.z[entity] = player.transform.position.z;
            
            Rotation.x[entity] = player.transform.rotation.x;
            Rotation.y[entity] = player.transform.rotation.y;
            Rotation.z[entity] = player.transform.rotation.z;
            Rotation.w[entity] = player.transform.rotation.w;
            
            Velocity.x[entity] = player.velocity.x;
            Velocity.y[entity] = player.velocity.y;
            Velocity.z[entity] = player.velocity.z;
            
            // Set up rendering
            renderer.scene.add(avatar.vrm.scene);
            const meshId = createRenderableId(avatar.vrm.scene);
            Renderable.meshId[entity] = meshId;
            
            // Store VRM reference on the scene object
            (avatar.vrm.scene as any).vrm = avatar.vrm;
            
            // Set up animation
            const mixerId = createAnimationMixer(avatar.vrm.scene);
            AnimationMixer.mixerId[entity] = mixerId;
            
            // Create physics body
            const physicsWorld = ClientPhysicsWorld.getInstance();
            const body = physicsWorld.createPlayerBody(entity, player.transform.position);
            const bodyId = createPhysicsBody(body);
            PhysicsBody.bodyId[entity] = bodyId;
            
            if (isLocal) {
              addComponent(world, LocalPlayer, entity);
            } else {
              // Add interpolation target for remote players
              addComponent(world, InterpolationTarget, entity);
              InterpolationTarget.x[entity] = player.transform.position.x;
              InterpolationTarget.y[entity] = player.transform.position.y;
              InterpolationTarget.z[entity] = player.transform.position.z;
              InterpolationTarget.rx[entity] = player.transform.rotation.x;
              InterpolationTarget.ry[entity] = player.transform.rotation.y;
              InterpolationTarget.rz[entity] = player.transform.rotation.z;
              InterpolationTarget.rw[entity] = player.transform.rotation.w;
              InterpolationTarget.progress[entity] = 1;
              InterpolationTarget.timeSinceUpdate[entity] = 0;
            }
            
          } catch (error) {
            console.error(`Failed to create player entity for ${playerId}:`, error);
          } finally {
            avatarsBeingCreated.delete(playerId);
          }
        }
      }
      
      // Update existing player entities from snapshot
      for (const [playerId, entity] of playerEntityMap) {
        const player = store.players.get(playerId);
        
        if (player) {
          // For remote players, update interpolation target
          if (!hasComponent(world, LocalPlayer, entity)) {
            InterpolationTarget.x[entity] = player.transform.position.x;
            InterpolationTarget.y[entity] = player.transform.position.y;
            InterpolationTarget.z[entity] = player.transform.position.z;
            InterpolationTarget.rx[entity] = player.transform.rotation.x;
            InterpolationTarget.ry[entity] = player.transform.rotation.y;
            InterpolationTarget.rz[entity] = player.transform.rotation.z;
            InterpolationTarget.rw[entity] = player.transform.rotation.w;
            InterpolationTarget.progress[entity] = 0; // Reset interpolation
            InterpolationTarget.timeSinceUpdate[entity] = 0;
            
            // Update velocity for animation
            Velocity.x[entity] = player.velocity.x;
            Velocity.y[entity] = player.velocity.y;
            Velocity.z[entity] = player.velocity.z;
          }
        } else {
          // Player left - remove entity
          const meshId = Renderable.meshId[entity];
          const meshObject = getRenderableObject(meshId);
          if (meshObject) {
            renderer.scene.remove(meshObject);
            // Dispose VRM if present
            const vrm = (meshObject as any).vrm;
            if (vrm && vrm.scene) {
              vrm.scene.traverse((obj: any) => {
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
          
          // Clean up mixer
          const mixerId = AnimationMixer.mixerId[entity];
          removeAnimationMixer(mixerId);
          
          // Clean up physics body
          const bodyId = PhysicsBody.bodyId[entity];
          removePhysicsBody(bodyId);
          const physicsWorld = ClientPhysicsWorld.getInstance();
          physicsWorld.removePlayerBody(entity);
          
          // Remove from maps
          playerEntityMap.delete(playerId);
          entityPlayerMap.delete(entity);
          
          // Remove entity from world
          removeEntity(world, entity);
        }
      }
      
      // Handle local player reconciliation
      if (store.playerId) {
        const localEntity = playerEntityMap.get(store.playerId);
        const serverPlayer = store.players.get(store.playerId);
        
        if (localEntity && serverPlayer) {
          // This will be handled by ClientPredictionSystem
          // For now, just update spawn position tracking
          networkManager.setSpawnPosition({
            x: Position.x[localEntity],
            y: Position.y[localEntity],
            z: Position.z[localEntity]
          });
        }
      }
      
    } finally {
      isUpdatingFromSnapshot = false;
    }
    })(); // End async IIFE
    
    return world;
  });
};

// Helper imports
import { getRenderableObject } from '../components/renderable';
import { removeAnimationMixer } from '../components/animationMixer';

// Export entity lookup functions
export function getEntityForPlayer(playerId: string): number | undefined {
  return playerEntityMap.get(playerId);
}

export function getPlayerForEntity(entity: number): string | undefined {
  return entityPlayerMap.get(entity);
}