import * as THREE from 'three';
import { PlayerInput, Vector3 } from '@motionjs/common';
import { useGameStore } from '../store/gameStore';

export class PlayerController {
  private keys: Set<string> = new Set();
  private movement: THREE.Vector3 = new THREE.Vector3();
  private readonly moveSpeed = 10;
  private readonly rotationSpeed = 2;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', e => {
      this.keys.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', e => {
      this.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  getInput(deltaTime: number): PlayerInput {
    this.movement.set(0, 0, 0);

    if (this.keys.has('w')) this.movement.z -= 1;
    if (this.keys.has('s')) this.movement.z += 1;
    if (this.keys.has('a')) this.movement.x -= 1;
    if (this.keys.has('d')) this.movement.x += 1;

    // Normalize horizontal movement only
    const horizontalLength = Math.sqrt(this.movement.x * this.movement.x + this.movement.z * this.movement.z);
    if (horizontalLength > 0) {
      this.movement.x /= horizontalLength;
      this.movement.z /= horizontalLength;
    }

    // Set movement.y = 1 when jumping
    if (this.keys.has(' ')) {
      this.movement.y = 1;
    }

    const store = useGameStore.getState();
    const sequenceNumber = store.incrementInputSequence();

    return {
      movement: {
        x: this.movement.x,
        y: this.movement.y,
        z: this.movement.z,
      },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      actions: {
        fire: this.keys.has('e'),
      },
      timestamp: Date.now(),
      sequenceNumber,
    };
  }

  isMoving(): boolean {
    return (
      this.keys.has('w') ||
      this.keys.has('s') ||
      this.keys.has('a') ||
      this.keys.has('d') ||
      this.keys.has(' ')
    );
  }
}
