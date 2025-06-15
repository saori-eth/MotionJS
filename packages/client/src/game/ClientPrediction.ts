import * as THREE from 'three';
import { PlayerInput, Player, Vector3 } from '@motionjs/common';

interface InputHistory {
  input: PlayerInput;
  frameId: number;
}

interface PhysicsState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isGrounded: boolean;
}

export class ClientPrediction {
  private inputHistory: InputHistory[] = [];
  private readonly maxHistorySize = 120;
  
  // Physics constants matching server
  private readonly gravity = -9.82;
  private readonly moveSpeed = 10;
  private readonly jumpVelocity = 12;
  private readonly linearDamping = 0.1;
  
  // Capsule dimensions matching server
  private readonly capsuleRadius = 0.4;
  private readonly capsuleHeight = 1.8;
  private readonly capsuleBottom = this.capsuleHeight / 2 + this.capsuleRadius; // Distance from center to bottom
  
  private physicsState: PhysicsState = {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    isGrounded: false
  };
  
  addInput(input: PlayerInput): void {
    this.inputHistory.push({
      input,
      frameId: input.sequenceNumber
    });
    
    if (this.inputHistory.length > this.maxHistorySize) {
      this.inputHistory.shift();
    }
  }
  
  predictPosition(
    currentPosition: THREE.Vector3,
    input: PlayerInput,
    deltaTime: number
  ): Vector3 {
    // Update physics state position
    this.physicsState.position.copy(currentPosition);
    
    // Apply movement input
    this.physicsState.velocity.x = input.movement.x * this.moveSpeed;
    this.physicsState.velocity.z = input.movement.z * this.moveSpeed;
    
    // Floating capsule behavior
    const hoverHeight = 1.5; // Desired hover height above ground
    const currentHeight = this.physicsState.position.y;
    const groundDistance = currentHeight - hoverHeight;
    
    // Apply hover force to maintain floating height
    if (groundDistance < 0.5) {
      // Apply upward force when too close to ground
      const hoverForce = (0.5 - groundDistance) * 50;
      this.physicsState.velocity.y += hoverForce * deltaTime;
    }
    
    // Handle jumping
    const canJump = groundDistance < 0.3; // Can jump when close to hover height
    if (input.movement.y > 0 && canJump) {
      this.physicsState.velocity.y = this.jumpVelocity;
    }
    
    // Apply gravity
    this.physicsState.velocity.y += this.gravity * deltaTime;
    
    // Apply stronger damping for floating effect
    if (groundDistance >= -0.1 && groundDistance <= 0.5) {
      this.physicsState.velocity.y *= 0.9; // Extra damping near hover height
    } else {
      // Normal damping
      this.physicsState.velocity.y *= (1 - this.linearDamping * deltaTime);
    }
    
    // Update position
    this.physicsState.position.x += this.physicsState.velocity.x * deltaTime;
    this.physicsState.position.y += this.physicsState.velocity.y * deltaTime;
    this.physicsState.position.z += this.physicsState.velocity.z * deltaTime;
    
    // Prevent going through ground
    if (this.physicsState.position.y < this.capsuleBottom) {
      this.physicsState.position.y = this.capsuleBottom;
      this.physicsState.velocity.y = 0;
    }
    
    return {
      x: this.physicsState.position.x,
      y: this.physicsState.position.y,
      z: this.physicsState.position.z
    };
  }
  
  reconcile(serverPlayer: Player, serverFrameId: number): void {
    // Update physics state from server
    this.physicsState.position.set(
      serverPlayer.transform.position.x,
      serverPlayer.transform.position.y,
      serverPlayer.transform.position.z
    );
    
    this.physicsState.velocity.set(
      serverPlayer.velocity.x,
      serverPlayer.velocity.y,
      serverPlayer.velocity.z
    );
    
    // Re-apply inputs that happened after the server update
    const relevantInputs = this.inputHistory.filter(
      history => history.frameId > serverFrameId
    );
    
    // Simulate forward from server state
    for (const history of relevantInputs) {
      this.predictPosition(this.physicsState.position, history.input, 1/60);
    }
    
    this.inputHistory = relevantInputs;
  }
  
  clear(): void {
    this.inputHistory = [];
    this.physicsState.velocity.set(0, 0, 0);
  }
}