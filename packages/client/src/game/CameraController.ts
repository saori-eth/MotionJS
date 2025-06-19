import * as THREE from 'three';

export class CameraController {
  private offset: THREE.Vector3 = new THREE.Vector3(0, 4, 6);
  private lookAtOffset: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  private smoothness: number = 0.1;

  constructor(private camera: THREE.Camera) {}

  follow(target: THREE.Object3D, deltaTime: number): void {
    const desiredPosition = target.position.clone().add(this.offset);
    const desiredLookAt = target.position.clone().add(this.lookAtOffset);

    this.camera.position.lerp(desiredPosition, this.smoothness);
    this.camera.lookAt(desiredLookAt);
  }

  setOffset(x: number, y: number, z: number): void {
    this.offset.set(x, y, z);
  }

  setSmoothness(smoothness: number): void {
    this.smoothness = Math.max(0.01, Math.min(1, smoothness));
  }
}
