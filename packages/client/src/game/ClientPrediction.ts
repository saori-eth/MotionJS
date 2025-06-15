import * as THREE from 'three';
import { PlayerInput, Player, Vector3 } from '@motionjs/common';

interface InputHistory {
  input: PlayerInput;
  frameId: number;
}

export class ClientPrediction {
  private inputHistory: InputHistory[] = [];
  private readonly maxHistorySize = 120;
  
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
    const predicted = currentPosition.clone();
    predicted.x += input.movement.x;
    predicted.y += input.movement.y;
    predicted.z += input.movement.z;
    
    return {
      x: predicted.x,
      y: predicted.y,
      z: predicted.z
    };
  }
  
  reconcile(serverPlayer: Player, serverFrameId: number): void {
    const relevantInputs = this.inputHistory.filter(
      history => history.frameId > serverFrameId
    );
    
    this.inputHistory = relevantInputs;
  }
  
  clear(): void {
    this.inputHistory = [];
  }
}