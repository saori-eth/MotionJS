import { Entity } from './Entity.js';

export type QueryPredicate = (entity: Entity) => boolean;

export class World {
  private entities: Map<string, Entity> = new Map();
  private componentIndex: Map<string, Set<Entity>> = new Map();

  createEntity(id?: string): Entity {
    const entity = new Entity(this, id);
    this.entities.set(entity.id, entity);
    return entity;
  }

  removeEntity(entity: Entity): void {
    this.entities.delete(entity.id);

    for (const [componentType, entities] of this.componentIndex) {
      entities.delete(entity);
    }
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  query(predicate: QueryPredicate): Entity[] {
    const results: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (predicate(entity)) {
        results.push(entity);
      }
    }
    return results;
  }

  queryByComponents(...componentTypes: string[]): Entity[] {
    if (componentTypes.length === 0) return [];

    let smallest: Set<Entity> | undefined;
    let smallestSize = Infinity;

    for (const type of componentTypes) {
      const entities = this.componentIndex.get(type);
      if (!entities) return [];
      if (entities.size < smallestSize) {
        smallest = entities;
        smallestSize = entities.size;
      }
    }

    if (!smallest) return [];

    const results: Entity[] = [];
    for (const entity of smallest) {
      if (entity.hasComponents(...componentTypes)) {
        results.push(entity);
      }
    }

    return results;
  }

  onComponentAdded(entity: Entity, componentType: string): void {
    if (!this.componentIndex.has(componentType)) {
      this.componentIndex.set(componentType, new Set());
    }
    this.componentIndex.get(componentType)!.add(entity);
  }

  onComponentRemoved(entity: Entity, componentType: string): void {
    this.componentIndex.get(componentType)?.delete(entity);
  }

  clear(): void {
    this.entities.clear();
    this.componentIndex.clear();
  }
}
