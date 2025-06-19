import * as CANNON from 'cannon-es';
import { Vector3 } from '@motionjs/common';

export class ClientPhysicsWorld {
  private static instance: ClientPhysicsWorld;
  private world: CANNON.World;
  private bodies: Map<number, CANNON.Body> = new Map();
  private fixedTimeStep = 1 / 60;
  private maxSubSteps = 3;
  private accumulator = 0;

  private constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    (this.world.solver as any).iterations = 10;

    this.setupGround();
  }

  static getInstance(): ClientPhysicsWorld {
    if (!ClientPhysicsWorld.instance) {
      ClientPhysicsWorld.instance = new ClientPhysicsWorld();
    }
    return ClientPhysicsWorld.instance;
  }

  private setupGround(): void {
    const groundShape = new CANNON.Box(new CANNON.Vec3(50, 0.1, 50));
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: groundShape,
      position: new CANNON.Vec3(0, 0, 0),
    });

    this.world.addBody(groundBody);
  }

  createPlayerBody(entityId: number, position: Vector3): CANNON.Body {
    // Create a capsule collider using compound shape (matching server)
    const radius = 0.4;
    const height = 1.8;
    const halfHeight = height / 2;

    // Create compound body for capsule
    const body = new CANNON.Body({
      mass: 80,
      position: new CANNON.Vec3(position.x, position.y, position.z),
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

    this.world.addBody(body);
    this.bodies.set(entityId, body);

    return body;
  }

  removePlayerBody(entityId: number): void {
    const body = this.bodies.get(entityId);
    if (body) {
      this.world.removeBody(body);
      this.bodies.delete(entityId);
    }
  }

  applyHoverAndDamping(body: CANNON.Body): void {
    // Floating capsule behavior (matching server)
    const hoverHeight = 1.5; // Desired hover height above ground
    const currentHeight = body.position.y;
    const groundDistance = currentHeight - hoverHeight;

    // Apply hover force to maintain floating height
    if (groundDistance < 0.5) {
      // Apply upward force when too close to ground
      const hoverForce = (0.5 - groundDistance) * 50;
      body.velocity.y += hoverForce * (1 / 60); // Apply force over fixed timestep
    }

    // Apply stronger damping for floating effect
    if (groundDistance >= -0.1 && groundDistance <= 0.5) {
      body.velocity.y *= 0.9; // Extra damping near hover height
    }

    // Apply horizontal damping to prevent infinite sliding
    const horizontalDamping = 0.9; // Higher value = less damping, lower value = more damping
    body.velocity.x *= horizontalDamping;
    body.velocity.z *= horizontalDamping;
  }

  applyPlayerInput(body: CANNON.Body, movement: Vector3): void {
    // Direct velocity control for responsive movement (matching server)
    const speed = 10;

    // Set target velocity based on input
    const targetVelX = movement.x * speed;
    const targetVelZ = movement.z * speed;

    // Apply acceleration towards target velocity (more responsive than direct setting)
    const acceleration = 50; // How quickly to reach target velocity
    const deltaVelX = targetVelX - body.velocity.x;
    const deltaVelZ = targetVelZ - body.velocity.z;

    body.velocity.x += deltaVelX * acceleration * (1 / 60);
    body.velocity.z += deltaVelZ * acceleration * (1 / 60);

    // Handle jumping
    const hoverHeight = 1.5; // Desired hover height above ground
    const currentHeight = body.position.y;
    const groundDistance = currentHeight - hoverHeight;
    const canJump = groundDistance < 0.3; // Can jump when close to hover height
    if (movement.y > 0 && canJump) {
      body.velocity.y = 12; // Jump velocity
    }
  }

  step(deltaTime: number): void {
    // Apply hover physics to all player bodies before world step
    for (const body of this.bodies.values()) {
      this.applyHoverAndDamping(body);
    }

    this.world.step(this.fixedTimeStep, deltaTime, this.maxSubSteps);
  }

  getBody(entityId: number): CANNON.Body | undefined {
    return this.bodies.get(entityId);
  }

  getWorld(): CANNON.World {
    return this.world;
  }
}