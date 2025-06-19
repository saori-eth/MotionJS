import { defineComponent, Types } from 'bitecs';
import { Object3D } from 'three';

export const Renderable = defineComponent({
  meshId: Types.ui32
});

export const renderableObjects = new Map<number, Object3D>();

let nextMeshId = 1;

export function createRenderableId(object: Object3D): number {
  const meshId = nextMeshId++;
  renderableObjects.set(meshId, object);
  return meshId;
}

export function getRenderableObject(meshId: number): Object3D | undefined {
  return renderableObjects.get(meshId);
}

export function removeRenderableObject(meshId: number): void {
  renderableObjects.delete(meshId);
}