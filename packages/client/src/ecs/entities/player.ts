import { addEntity, addComponent, IWorld } from 'bitecs';
import { 
  Position, 
  Rotation, 
  Velocity, 
  Player, 
  LocalPlayer, 
  Renderable,
  getOrCreateNumericPlayerId,
  createRenderableId
} from '../components';
import { Player as CommonPlayer } from '@motionjs/common';
import { Object3D } from 'three';

export function createPlayerEntity(
  world: IWorld, 
  player: CommonPlayer, 
  mesh: Object3D | null,
  isLocal: boolean = false
): number {
  const entity = addEntity(world);
  
  // Add core components
  addComponent(world, Position, entity);
  addComponent(world, Rotation, entity);
  addComponent(world, Velocity, entity);
  addComponent(world, Player, entity);
  
  // Set player ID
  const numericId = getOrCreateNumericPlayerId(player.id);
  Player.id[entity] = numericId;
  
  // Set initial position
  Position.x[entity] = player.transform.position.x;
  Position.y[entity] = player.transform.position.y;
  Position.z[entity] = player.transform.position.z;
  
  // Set initial rotation (quaternion)
  Rotation.x[entity] = player.transform.rotation.x;
  Rotation.y[entity] = player.transform.rotation.y;
  Rotation.z[entity] = player.transform.rotation.z;
  Rotation.w[entity] = player.transform.rotation.w;
  
  // Set initial velocity
  Velocity.x[entity] = player.velocity.x;
  Velocity.y[entity] = player.velocity.y;
  Velocity.z[entity] = player.velocity.z;
  
  // Add local player tag if needed
  if (isLocal) {
    addComponent(world, LocalPlayer, entity);
  }
  
  // Add renderable component if mesh provided
  if (mesh) {
    addComponent(world, Renderable, entity);
    Renderable.meshId[entity] = createRenderableId(mesh);
  }
  
  return entity;
}