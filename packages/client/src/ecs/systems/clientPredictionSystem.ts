import { defineQuery, defineSystem } from 'bitecs';
import { Position, Rotation, LocalPlayer, Player, PhysicsBody, getStringPlayerId } from '../components';
import { getPhysicsBody } from '../components/physicsBody';
import { ClientPhysicsWorld } from '../physics/ClientPhysicsWorld';
import { GameWorld } from '../world';
import { useGameStore } from '../../store/gameStore';
import { PlayerInput } from '@motionjs/common';
import * as CANNON from 'cannon-es';

// Physics constants matching server
const GRAVITY = -9.82;
const MOVE_SPEED = 10;
const JUMP_VELOCITY = 12;
const LINEAR_DAMPING = 0.1;

// Capsule dimensions matching server
const CAPSULE_RADIUS = 0.4;
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_BOTTOM = CAPSULE_HEIGHT / 2 + CAPSULE_RADIUS;

// Input history for reconciliation
interface InputHistory {
  input: PlayerInput;
  frameId: number;
}

const inputHistoryMap = new Map<number, InputHistory[]>();
const MAX_HISTORY_SIZE = 120;

// Query for local player entities
const localPlayerQuery = defineQuery([Position, Rotation, LocalPlayer, Player, PhysicsBody]);

export const createClientPredictionSystem = () => {
  const physicsWorld = ClientPhysicsWorld.getInstance();
  let lastReconciliationFrame = -1;
  
  return defineSystem((world: GameWorld) => {
    const entities = localPlayerQuery(world);
    const store = useGameStore.getState();
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      // Get or create input history for this entity
      if (!inputHistoryMap.has(entity)) {
        inputHistoryMap.set(entity, []);
      }
      const inputHistory = inputHistoryMap.get(entity)!;
      
      // Get player ID
      const numericPlayerId = Player.id[entity];
      const playerId = getStringPlayerId(numericPlayerId);
      
      if (!playerId) continue;
      
      // Get physics body
      const bodyId = PhysicsBody.bodyId[entity];
      const body = getPhysicsBody(bodyId);
      
      if (!body) continue;
      
      // Check if we need to reconcile with server state
      const serverPlayer = store.players.get(playerId);
      const latestSnapshot = store.latestSnapshot;
      
      if (serverPlayer && latestSnapshot && latestSnapshot.frameId > lastReconciliationFrame) {
        lastReconciliationFrame = latestSnapshot.frameId;
        
        // Save current client position for comparison
        const clientPos = {
          x: body.position.x,
          y: body.position.y,
          z: body.position.z
        };
        
        // Calculate error between client and server
        const errorX = Math.abs(clientPos.x - serverPlayer.transform.position.x);
        const errorY = Math.abs(clientPos.y - serverPlayer.transform.position.y);
        const errorZ = Math.abs(clientPos.z - serverPlayer.transform.position.z);
        const totalError = Math.sqrt(errorX * errorX + errorY * errorY + errorZ * errorZ);
        
        // Only reconcile if error is significant (more than 0.1 units)
        if (totalError > 0.1) {
          // Use smooth correction instead of hard snap
          const correctionFactor = 0.1; // How fast to correct (0-1)
          
          // Blend position towards server state
          body.position.x += (serverPlayer.transform.position.x - body.position.x) * correctionFactor;
          body.position.y += (serverPlayer.transform.position.y - body.position.y) * correctionFactor;
          body.position.z += (serverPlayer.transform.position.z - body.position.z) * correctionFactor;
          
          // Also blend velocity for smoother correction
          body.velocity.x += (serverPlayer.velocity.x - body.velocity.x) * correctionFactor;
          body.velocity.y += (serverPlayer.velocity.y - body.velocity.y) * correctionFactor;
          body.velocity.z += (serverPlayer.velocity.z - body.velocity.z) * correctionFactor;
          
          // Update quaternion
          body.quaternion.set(
            serverPlayer.transform.rotation.x,
            serverPlayer.transform.rotation.y,
            serverPlayer.transform.rotation.z,
            serverPlayer.transform.rotation.w
          );
        }
        
        // Keep only relevant inputs
        const relevantInputs = inputHistory.filter(
          history => history.frameId > latestSnapshot.frameId
        );
        inputHistoryMap.set(entity, relevantInputs);
      }
    }
    
    // Clean up input history for entities that no longer exist
    const existingEntities = localPlayerQuery(world);
    for (const [entity] of inputHistoryMap) {
      let found = false;
      for (let i = 0; i < existingEntities.length; i++) {
        if (existingEntities[i] === entity) {
          found = true;
          break;
        }
      }
      if (!found) {
        inputHistoryMap.delete(entity);
      }
    }
    
    return world;
  });
};


// Export function to add input to history
export function addInputToHistory(entity: number, input: PlayerInput): void {
  if (!inputHistoryMap.has(entity)) {
    inputHistoryMap.set(entity, []);
  }
  
  const history = inputHistoryMap.get(entity)!;
  history.push({
    input,
    frameId: input.sequenceNumber
  });
  
  // Limit history size
  if (history.length > MAX_HISTORY_SIZE) {
    history.shift();
  }
}