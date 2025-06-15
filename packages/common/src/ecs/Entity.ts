import { World } from './World.js';

export class Entity {
  private static nextId = 1;
  
  readonly id: string;
  private components: Map<string, any> = new Map();
  private world: World;
  
  constructor(world: World, id?: string) {
    this.world = world;
    this.id = id || `entity_${Entity.nextId++}`;
  }
  
  addComponent<T>(componentType: string, component: T): this {
    this.components.set(componentType, component);
    this.world.onComponentAdded(this, componentType);
    return this;
  }
  
  removeComponent(componentType: string): this {
    if (this.components.has(componentType)) {
      this.components.delete(componentType);
      this.world.onComponentRemoved(this, componentType);
    }
    return this;
  }
  
  getComponent<T>(componentType: string): T | undefined {
    return this.components.get(componentType);
  }
  
  hasComponent(componentType: string): boolean {
    return this.components.has(componentType);
  }
  
  hasComponents(...componentTypes: string[]): boolean {
    return componentTypes.every(type => this.components.has(type));
  }
  
  destroy(): void {
    this.world.removeEntity(this);
  }
}