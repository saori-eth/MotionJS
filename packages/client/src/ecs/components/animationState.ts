import { defineComponent, Types } from 'bitecs';

export const AnimationState = defineComponent({
  currentState: Types.ui8, // 0: idle, 1: walk, 2: run, 3: jump
  previousState: Types.ui8,
  transitionTime: Types.f32,
});

// Animation state enums
export const AnimationStates = {
  IDLE: 0,
  WALK: 1,
  RUN: 2,
  JUMP: 3,
} as const;

export type AnimationStateType = typeof AnimationStates[keyof typeof AnimationStates];