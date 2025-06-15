import * as THREE from 'three';
import { Player } from '@motionjs/common';

export class PlayerAvatar {
  public mesh: THREE.Mesh;
  private targetPosition: THREE.Vector3;
  private currentPosition: THREE.Vector3;
  
  constructor(player: Player, isLocal: boolean = false) {
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshStandardMaterial({
      color: isLocal ? 0x0066cc : 0xcc6600,
      roughness: 0.7,
      metalness: 0.3
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    this.targetPosition = new THREE.Vector3(
      player.transform.position.x,
      player.transform.position.y,
      player.transform.position.z
    );
    
    this.currentPosition = this.targetPosition.clone();
    this.mesh.position.copy(this.currentPosition);
  }
  
  updateFromPlayer(player: Player, deltaTime: number): void {
    this.targetPosition.set(
      player.transform.position.x,
      player.transform.position.y,
      player.transform.position.z
    );
    
    this.currentPosition.lerp(this.targetPosition, Math.min(deltaTime * 10, 1));
    this.mesh.position.copy(this.currentPosition);
    
    this.mesh.quaternion.set(
      player.transform.rotation.x,
      player.transform.rotation.y,
      player.transform.rotation.z,
      player.transform.rotation.w
    );
  }
  
  setPosition(x: number, y: number, z: number): void {
    this.targetPosition.set(x, y, z);
    this.currentPosition.copy(this.targetPosition);
    this.mesh.position.copy(this.currentPosition);
  }
  
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}