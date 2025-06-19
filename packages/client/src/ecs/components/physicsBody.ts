import { defineComponent, Types } from 'bitecs';
import * as CANNON from 'cannon-es';

export const PhysicsBody = defineComponent({
  bodyId: Types.ui32
});

// Store actual CANNON bodies
export const physicsBodies = new Map<number, CANNON.Body>();

let nextBodyId = 1;

export function createPhysicsBody(body: CANNON.Body): number {
  const bodyId = nextBodyId++;
  physicsBodies.set(bodyId, body);
  return bodyId;
}

export function getPhysicsBody(bodyId: number): CANNON.Body | undefined {
  return physicsBodies.get(bodyId);
}

export function removePhysicsBody(bodyId: number): void {
  physicsBodies.delete(bodyId);
}