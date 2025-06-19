import { defineComponent, Types } from 'bitecs';

export const InterpolationTarget = defineComponent({
  // Target position
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
  
  // Target rotation (quaternion)
  rx: Types.f32,
  ry: Types.f32,
  rz: Types.f32,
  rw: Types.f32,
  
  // Interpolation progress (0-1)
  progress: Types.f32,
  
  // Time since last update
  timeSinceUpdate: Types.f32,
});