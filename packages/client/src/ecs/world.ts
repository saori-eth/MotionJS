import { createWorld, IWorld } from 'bitecs';

export interface GameWorld extends IWorld {
  time: {
    delta: number;
    elapsed: number;
  };
}

export const world = createWorld() as GameWorld;
world.time = { delta: 0, elapsed: 0 };