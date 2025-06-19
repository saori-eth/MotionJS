import { defineQuery, defineSystem, Not } from 'bitecs';
import { Position, Rotation, InterpolationTarget, LocalPlayer } from '../components';
import { GameWorld } from '../world';

// Query for remote players (entities with InterpolationTarget but not LocalPlayer)
const remotePlayersQuery = defineQuery([Position, Rotation, InterpolationTarget, Not(LocalPlayer)]);

// Interpolation settings
const INTERPOLATION_RATE = 0.1; // How fast to interpolate (0-1)
const POSITION_THRESHOLD = 0.01; // Stop interpolating when this close

export const createInterpolationSystem = () => {
  return defineSystem((world: GameWorld) => {
    const entities = remotePlayersQuery(world);
    const deltaTime = world.time.delta;
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      // Update time since last update
      InterpolationTarget.timeSinceUpdate[entity] += deltaTime;
      
      // Get current and target positions
      const currentX = Position.x[entity];
      const currentY = Position.y[entity];
      const currentZ = Position.z[entity];
      
      const targetX = InterpolationTarget.x[entity];
      const targetY = InterpolationTarget.y[entity];
      const targetZ = InterpolationTarget.z[entity];
      
      // Calculate distance to target
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      const dz = targetZ - currentZ;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // Interpolate position if not at target
      if (distance > POSITION_THRESHOLD) {
        const t = Math.min(INTERPOLATION_RATE * deltaTime * 60, 1); // Frame-independent interpolation
        
        Position.x[entity] = currentX + dx * t;
        Position.y[entity] = currentY + dy * t;
        Position.z[entity] = currentZ + dz * t;
      } else {
        // Snap to target if close enough
        Position.x[entity] = targetX;
        Position.y[entity] = targetY;
        Position.z[entity] = targetZ;
      }
      
      // Interpolate rotation (quaternion SLERP)
      const currentQuat = {
        x: Rotation.x[entity],
        y: Rotation.y[entity],
        z: Rotation.z[entity],
        w: Rotation.w[entity]
      };
      
      const targetQuat = {
        x: InterpolationTarget.rx[entity],
        y: InterpolationTarget.ry[entity],
        z: InterpolationTarget.rz[entity],
        w: InterpolationTarget.rw[entity]
      };
      
      // Simple quaternion interpolation (not true SLERP but good enough for most cases)
      const t = Math.min(INTERPOLATION_RATE * deltaTime * 60, 1);
      
      // Check if quaternions are in the same hemisphere
      let dot = currentQuat.x * targetQuat.x + 
                currentQuat.y * targetQuat.y + 
                currentQuat.z * targetQuat.z + 
                currentQuat.w * targetQuat.w;
      
      // If dot is negative, negate one quaternion to take shorter path
      let factor = 1;
      if (dot < 0) {
        factor = -1;
        dot = -dot;
      }
      
      // If quaternions are very close, just copy target
      if (dot > 0.9995) {
        Rotation.x[entity] = targetQuat.x * factor;
        Rotation.y[entity] = targetQuat.y * factor;
        Rotation.z[entity] = targetQuat.z * factor;
        Rotation.w[entity] = targetQuat.w * factor;
      } else {
        // Linear interpolation with normalization
        const x = currentQuat.x + (targetQuat.x * factor - currentQuat.x) * t;
        const y = currentQuat.y + (targetQuat.y * factor - currentQuat.y) * t;
        const z = currentQuat.z + (targetQuat.z * factor - currentQuat.z) * t;
        const w = currentQuat.w + (targetQuat.w * factor - currentQuat.w) * t;
        
        // Normalize quaternion
        const len = Math.sqrt(x * x + y * y + z * z + w * w);
        if (len > 0) {
          Rotation.x[entity] = x / len;
          Rotation.y[entity] = y / len;
          Rotation.z[entity] = z / len;
          Rotation.w[entity] = w / len;
        }
      }
      
      // Update progress
      InterpolationTarget.progress[entity] = Math.min(
        InterpolationTarget.progress[entity] + t,
        1
      );
    }
    
    return world;
  });
};