export interface AnimationObject {
  id: string;
  rotation?: number;
  rotationX?: number;
  rotationY?: number;
  y?: number;
}

export interface PrimitiveConfig {
  type: string;
  position: { x: number; y: number; z: number };
  color: number;
  scale?: { x: number; y: number; z: number };
  wireframe?: boolean;
}

export function createAnimationObjects(
  animationTime: number
): AnimationObject[] {
  return [
    { id: "cube", rotation: animationTime },
    {
      id: "torus",
      rotationX: animationTime * 0.5,
      rotationY: animationTime * 1.5,
    },
    { id: "sphere", y: Math.sin(animationTime * 2) * 0.5 + 3 },
  ];
}

export function createPrimitiveConfigs(): Record<string, PrimitiveConfig> {
  return {
    cube: {
      type: "box",
      position: { x: 2, y: 2, z: 0 },
      color: 0xff0000,
      scale: { x: 1.5, y: 1.5, z: 1.5 },
    },
    torus: {
      type: "torus",
      position: { x: -2, y: 2, z: 0 },
      color: 0x0000ff,
    },
    sphere: {
      type: "sphere",
      position: { x: 0, y: 3, z: -2 },
      color: 0x00ff00,
    },
  };
}

export function updatePrimitiveFromAnimation(
  primitive: any,
  obj: AnimationObject
): void {
  if (obj.id === "cube" && obj.rotation !== undefined) {
    primitive.setRotation({ x: 0, y: obj.rotation, z: 0 });
  } else if (
    obj.id === "torus" &&
    obj.rotationX !== undefined &&
    obj.rotationY !== undefined
  ) {
    primitive.setRotation({
      x: obj.rotationX,
      y: obj.rotationY,
      z: 0,
    });
  } else if (obj.id === "sphere" && obj.y !== undefined) {
    primitive.setPosition({ x: 0, y: obj.y, z: -2 });
  }
}

export function spawnPrimitivesFromConfigs(
  spawnPrimitive: (config: any) => any,
  configs: Record<string, PrimitiveConfig>
): Record<string, any> {
  const primitives: Record<string, any> = {};

  for (const [id, config] of Object.entries(configs)) {
    primitives[id] = spawnPrimitive(config);
  }

  return primitives;
}
