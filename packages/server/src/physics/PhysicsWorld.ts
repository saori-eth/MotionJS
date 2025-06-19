import CANNON from 'cannon';
import { Vector3, PhysicsBody, Hit } from '@motionjs/common';

export class PhysicsWorld {
  private world: CANNON.World;
  private bodies: Map<string, CANNON.Body> = new Map();
  private fixedTimeStep = 1 / 60;
  private maxSubSteps = 3;

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;

    this.setupGround();
  }

  private setupGround(): void {
    const groundShape = new CANNON.Box(new CANNON.Vec3(50, 0.1, 50));
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: groundShape,
      position: new CANNON.Vec3(0, 0, 0),
    });

    this.world.add(groundBody);
  }

  createPlayerBody(playerId: string): CANNON.Body {
    // Create a capsule collider using compound shape
    // Capsule dimensions: radius 0.4, height 1.8 (excluding caps)
    const radius = 0.4;
    const height = 1.8;
    const halfHeight = height / 2;

    // Create compound body for capsule
    const body = new CANNON.Body({
      mass: 80,
      position: new CANNON.Vec3(
        Math.random() * 10 - 5, // Random spawn position
        2.5, // Start higher for floating capsule
        Math.random() * 10 - 5
      ),
      linearDamping: 0.1,
      angularDamping: 0.999, // Very high angular damping to prevent rolling
    });

    // Add cylinder for main body
    const cylinderShape = new CANNON.Box(new CANNON.Vec3(radius, halfHeight, radius));
    body.addShape(cylinderShape, new CANNON.Vec3(0, 0, 0));

    // Add spheres for top and bottom caps
    const sphereShape = new CANNON.Sphere(radius);
    body.addShape(sphereShape, new CANNON.Vec3(0, halfHeight, 0)); // Top cap
    body.addShape(sphereShape, new CANNON.Vec3(0, -halfHeight, 0)); // Bottom cap

    // Set low friction material
    const playerMaterial = new CANNON.Material('player');
    playerMaterial.friction = 0.1;
    playerMaterial.restitution = 0.1;
    body.material = playerMaterial;

    // Lock rotation on X and Z axes to keep capsule upright
    body.fixedRotation = true;
    body.updateMassProperties();

    this.world.add(body);
    this.bodies.set(playerId, body);

    return body;
  }

  removePlayerBody(playerId: string): void {
    const body = this.bodies.get(playerId);
    if (body) {
      this.world.remove(body);
      this.bodies.delete(playerId);
    }
  }

  applyPlayerInput(playerId: string, movement: Vector3): void {
    const body = this.bodies.get(playerId);
    if (!body) return;

    // Direct velocity control for responsive movement
    const speed = 10;
    body.velocity.x = movement.x * speed;
    body.velocity.z = movement.z * speed;

    // Floating capsule behavior
    const hoverHeight = 1.5; // Desired hover height above ground
    const currentHeight = body.position.y;
    const groundDistance = currentHeight - hoverHeight;

    // Apply hover force to maintain floating height
    if (groundDistance < 0.5) {
      // Apply upward force when too close to ground
      const hoverForce = (0.5 - groundDistance) * 50;
      body.velocity.y += hoverForce * (1 / 60); // Apply force over fixed timestep
    }

    // Handle jumping
    const canJump = groundDistance < 0.3; // Can jump when close to hover height
    if (movement.y > 0 && canJump) {
      body.velocity.y = 12; // Jump velocity
    }

    // Apply stronger damping for floating effect
    if (groundDistance >= -0.1 && groundDistance <= 0.5) {
      body.velocity.y *= 0.9; // Extra damping near hover height
    }
  }

  step(deltaTime: number): void {
    this.world.step(this.fixedTimeStep, deltaTime, this.maxSubSteps);
  }

  getPlayerPhysics(playerId: string): PhysicsBody | null {
    const body = this.bodies.get(playerId);
    if (!body) return null;

    return {
      position: {
        x: body.position.x,
        y: body.position.y,
        z: body.position.z,
      },
      quaternion: {
        x: body.quaternion.x,
        y: body.quaternion.y,
        z: body.quaternion.z,
        w: body.quaternion.w,
      },
      velocity: {
        x: body.velocity.x,
        y: body.velocity.y,
        z: body.velocity.z,
      },
      angularVelocity: {
        x: body.angularVelocity.x,
        y: body.angularVelocity.y,
        z: body.angularVelocity.z,
      },
      mass: body.mass,
    };
  }

  raycast(origin: Vector3, direction: Vector3, maxDistance: number = 100): Hit | null {
    const from = new CANNON.Vec3(origin.x, origin.y, origin.z);
    const to = new CANNON.Vec3(
      origin.x + direction.x * maxDistance,
      origin.y + direction.y * maxDistance,
      origin.z + direction.z * maxDistance
    );

    const result = new CANNON.RaycastResult();
    const hit = this.world.raycastClosest(from, to, {}, result);

    if (hit && result.body) {
      let entityId: string | undefined;
      let playerId: string | undefined;

      for (const [id, body] of this.bodies) {
        if (body === result.body) {
          playerId = id;
          break;
        }
      }

      return {
        point: {
          x: result.hitPointWorld.x,
          y: result.hitPointWorld.y,
          z: result.hitPointWorld.z,
        },
        normal: {
          x: result.hitNormalWorld.x,
          y: result.hitNormalWorld.y,
          z: result.hitNormalWorld.z,
        },
        distance: result.distance,
        entityId,
        playerId,
      };
    }

    return null;
  }
}
