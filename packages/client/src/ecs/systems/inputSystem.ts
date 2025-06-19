import { defineQuery, defineSystem, enterQuery, exitQuery } from 'bitecs';
import { LocalPlayer, Velocity, PhysicsBody } from '../components';
import { getPhysicsBody } from '../components/physicsBody';
import { ClientPhysicsWorld } from '../physics/ClientPhysicsWorld';
import { GameWorld } from '../world';
import { PlayerInput } from '@motionjs/common';
import { useGameStore } from '../../store/gameStore';
import { addInputToHistory } from './clientPredictionSystem';
import * as THREE from 'three';

// Input state management
const keys = new Set<string>();
const movement = new THREE.Vector3();
const moveSpeed = 10;

// Setup event listeners once
let initialized = false;
function setupEventListeners(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('keydown', e => {
    keys.add(e.key.toLowerCase());
  });

  window.addEventListener('keyup', e => {
    keys.delete(e.key.toLowerCase());
  });

  window.addEventListener('blur', () => {
    keys.clear();
  });
}

function getInput(): PlayerInput {
  movement.set(0, 0, 0);

  if (keys.has('w')) movement.z -= 1;
  if (keys.has('s')) movement.z += 1;
  if (keys.has('a')) movement.x -= 1;
  if (keys.has('d')) movement.x += 1;

  // Normalize horizontal movement only
  const horizontalLength = Math.sqrt(
    movement.x * movement.x + movement.z * movement.z
  );
  if (horizontalLength > 0) {
    movement.x /= horizontalLength;
    movement.z /= horizontalLength;
  }

  // Set movement.y = 1 when jumping
  if (keys.has(' ')) {
    movement.y = 1;
  }

  const store = useGameStore.getState();
  const sequenceNumber = store.incrementInputSequence();

  return {
    movement: {
      x: movement.x,
      y: movement.y,
      z: movement.z,
    },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    actions: {
      fire: keys.has('e'),
    },
    timestamp: Date.now(),
    sequenceNumber,
  };
}

function isMoving(): boolean {
  return (
    keys.has('w') ||
    keys.has('s') ||
    keys.has('a') ||
    keys.has('d') ||
    keys.has(' ')
  );
}

// Query for entities with LocalPlayer and PhysicsBody components
const localPlayerQuery = defineQuery([LocalPlayer, PhysicsBody]);
const localPlayerEnterQuery = enterQuery(localPlayerQuery);
const localPlayerExitQuery = exitQuery(localPlayerQuery);

export const createInputSystem = (networkManager: any) => {
  setupEventListeners();
  const physicsWorld = ClientPhysicsWorld.getInstance();
  
  return defineSystem((world: GameWorld) => {
    // Handle new local players
    const entered = localPlayerEnterQuery(world);
    if (entered.length > 0) {
      console.log('Local player entity created');
    }

    // Handle removed local players
    const exited = localPlayerExitQuery(world);
    if (exited.length > 0) {
      console.log('Local player entity removed');
    }

    // Process input for all local player entities
    const entities = localPlayerQuery(world);
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      if (isMoving() && networkManager.isConnected()) {
        const input = getInput();
        
        // Send input to server
        networkManager.sendInput(input);
        
        // Store input for prediction
        addInputToHistory(entity, input);
        
        // Apply input to physics body
        const bodyId = PhysicsBody.bodyId[entity];
        const body = getPhysicsBody(bodyId);
        
        if (body) {
          physicsWorld.applyPlayerInput(body, input.movement);
        }
      } else {
        // Not moving - apply zero input to stop
        const bodyId = PhysicsBody.bodyId[entity];
        const body = getPhysicsBody(bodyId);
        
        if (body) {
          physicsWorld.applyPlayerInput(body, { x: 0, y: 0, z: 0 });
        }
      }
    }

    return world;
  });
};