import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { Player } from '@motionjs/common';

export class PlayerAvatar {
  public mesh: THREE.Mesh;
  private targetPosition: THREE.Vector3;
  private currentPosition: THREE.Vector3;
  
  constructor(player: Player, isLocal: boolean = false) {
    // Create capsule geometry
    const radius = 0.4;
    const height = 1.8;
    const capSegments = 16;
    const radialSegments = 16;
    
    // Create cylinder for main body
    const cylinderGeometry = new THREE.CylinderGeometry(
      radius, 
      radius, 
      height, 
      radialSegments
    );
    
    // Create spheres for caps
    const sphereGeometry = new THREE.SphereGeometry(radius, capSegments, capSegments / 2);
    
    // Create a group to hold the capsule parts
    const capsuleGroup = new THREE.Group();
    
    const material = new THREE.MeshStandardMaterial({
      color: isLocal ? 0x0066cc : 0xcc6600,
      roughness: 0.7,
      metalness: 0.3
    });
    
    // Add cylinder
    const cylinderMesh = new THREE.Mesh(cylinderGeometry, material);
    capsuleGroup.add(cylinderMesh);
    
    // Add top hemisphere
    const topCapMesh = new THREE.Mesh(sphereGeometry, material);
    topCapMesh.position.y = height / 2;
    capsuleGroup.add(topCapMesh);
    
    // Add bottom hemisphere
    const bottomCapMesh = new THREE.Mesh(sphereGeometry, material);
    bottomCapMesh.position.y = -height / 2;
    capsuleGroup.add(bottomCapMesh);
    
    // Merge geometries for better performance
    const mergedGeometry = new THREE.BufferGeometry();
    capsuleGroup.updateMatrixWorld();
    
    const geometries: THREE.BufferGeometry[] = [];
    capsuleGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const clonedGeometry = child.geometry.clone();
        clonedGeometry.applyMatrix4(child.matrixWorld);
        geometries.push(clonedGeometry);
      }
    });
    
    if (geometries.length > 0) {
      const mergedBufferGeometry = mergeGeometries(geometries);
      mergedGeometry.copy(mergedBufferGeometry);
    }
    
    this.mesh = new THREE.Mesh(mergedGeometry, material);
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
      player.transform.position.y,  // No offset needed, capsule center aligns with physics body
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