import CANNON from 'cannon';
import { Vector3, PhysicsBody, Hit } from '@motionjs/common';

export class PhysicsWorld {
  private world: CANNON.World;
  private bodies: Map<string, CANNON.Body> = new Map();
  private fixedTimeStep = 1/60;
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
      position: new CANNON.Vec3(0, 0, 0)
    });
    
    this.world.add(groundBody);
  }
  
  createPlayerBody(playerId: string): CANNON.Body {
    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5));
    const body = new CANNON.Body({
      mass: 80,
      shape: shape,
      position: new CANNON.Vec3(
        Math.random() * 10 - 5,  // Random spawn position
        5,  // Higher spawn position
        Math.random() * 10 - 5
      ),
      linearDamping: 0.4,
      angularDamping: 0.4
    });
    
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
    
    const force = new CANNON.Vec3(
      movement.x * 500,
      movement.y * 1000,
      movement.z * 500
    );
    
    body.applyForce(force, body.position);
    
    const maxVelocity = 10;
    if (body.velocity.length() > maxVelocity) {
      body.velocity.normalize();
      body.velocity.scale(maxVelocity, body.velocity);
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
        z: body.position.z
      },
      quaternion: {
        x: body.quaternion.x,
        y: body.quaternion.y,
        z: body.quaternion.z,
        w: body.quaternion.w
      },
      velocity: {
        x: body.velocity.x,
        y: body.velocity.y,
        z: body.velocity.z
      },
      angularVelocity: {
        x: body.angularVelocity.x,
        y: body.angularVelocity.y,
        z: body.angularVelocity.z
      },
      mass: body.mass
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
          z: result.hitPointWorld.z
        },
        normal: {
          x: result.hitNormalWorld.x,
          y: result.hitNormalWorld.y,
          z: result.hitNormalWorld.z
        },
        distance: result.distance,
        entityId,
        playerId
      };
    }
    
    return null;
  }
}