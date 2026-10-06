import {
  AbstractMesh,
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImportMeshAsync,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
// Side-effect import: registers the glTF/GLB loader with the SceneLoader.
import "@babylonjs/loaders/glTF";

import { AnimationController } from "./AnimationController";
import { SkeletonRig } from "./SkeletonRig";
import { ProceduralMartialAnimator } from "./ProceduralMartialAnimator";
import { ProceduralStanceAnimator } from "./ProceduralStanceAnimator";
import { PairedMartialAnimator } from "./PairedMartialAnimator";
import { FighterCollisionRig, firstHitRegion } from "./FighterCollisionRig";
import { ProceduralHitReactionAnimator } from "./ProceduralHitReactionAnimator";
import { ProceduralKnockdownAnimator } from "./ProceduralKnockdownAnimator";
import { CollisionDebugView } from "./CollisionDebugView";
import { ProceduralClinchAnimator, type ClinchPoseId } from "./ProceduralClinchAnimator";
import { DefensivePoseOverlay } from "./DefensivePoseOverlay";
import { ProceduralGrappleDefenseAnimator } from "./ProceduralGrappleDefenseAnimator";
import { CharacterController } from "../game/CharacterController";
import { InputController } from "../game/InputController";
import { GamepadTechniqueInput } from "../game/GamepadTechniqueInput";
import { Opponent } from "./Opponent";
import { RingRopes } from "./RingRopes";
import { MayQuvMatch } from "../combat/MayQuvMatch";
import type { CombatSide, FighterLoadout } from "../combat/mayQuvTypes";
import { canSustainWhizzer, guardLevelFromArmCondition, regionConsequences } from "../combat/regionalCondition";
import { preferredBiomechPoseForStyle, styleById, techniqueById } from "../data/combatCatalog";
import { deriveMovementPhysics } from "../game/bodyPhysics";
import { FixedStep } from "../sim/FixedStep";
import { createDefaultMoveset, techniqueForMovesetInput, validateMoveset, type FighterMoveset, type MovesetButton } from "../combat/moveset";
import { listMovesets } from "../combat/movesetStore";
import { BotBrain } from "../ai/BotBrain";
import { InputBuffer } from "../sim/InputBuffer";
import {
  MODEL_ROOT,
  TEXTURE_ROOT,
  CharacterDefinition,
  REQUIRED_CLIPS,
  RING,
  SPAWN,
  opponentFor,
  RING_VIEW,
  RingBounds,
  Tuning,
} from "../game/config";

/**
 * Owns the engine, the scene and the render loop. A single instance lives for
 * as long as the canvas does; `loadCharacter` can be called repeatedly to swap
 * the player model without tearing anything else down.
 */
export class GameScene {
  readonly engine: Engine;
  readonly scene: Scene;

  private camera: ArcRotateCamera;
  private shadows: ShadowGenerator;
  private input: InputController;
  private readonly gamepadTechnique = new GamepadTechniqueInput();
  private arenaFloor: Mesh | null = null;

  private playerRoot: TransformNode | null = null;
  private controller: CharacterController | null = null;
  private animations: AnimationController | null = null;
  private playerProcedural: ProceduralMartialAnimator | null = null;
  private opponentProcedural: ProceduralMartialAnimator | null = null;
  private playerStanceProcedural: ProceduralStanceAnimator | null = null;
  private playerRig: SkeletonRig | null = null;
  private opponentRig: SkeletonRig | null = null;
  private pairedProcedural: PairedMartialAnimator | null = null;
  private opponentPairedProcedural: PairedMartialAnimator | null = null;
  private playerCollision: FighterCollisionRig | null = null;
  private opponentCollision: FighterCollisionRig | null = null;
  private playerReactions: ProceduralHitReactionAnimator | null = null;
  private opponentReactions: ProceduralHitReactionAnimator | null = null;
  private playerKnockdown: ProceduralKnockdownAnimator | null = null;
  private opponentKnockdown: ProceduralKnockdownAnimator | null = null;
  private collisionDebug: CollisionDebugView | null = null;
  private clinchProcedural: ProceduralClinchAnimator | null = null;
  private currentClinchPose: ClinchPoseId | null = null;
  private defensiveOverlay: DefensivePoseOverlay | null = null;
  private opponentDefensiveOverlay: DefensivePoseOverlay | null = null;
  private grappleDefenseProcedural: ProceduralGrappleDefenseAnimator | null = null;
  private opponentGrappleDefenseProcedural: ProceduralGrappleDefenseAnimator | null = null;
  /** Play area inside the ropes, derived from the ring geometry. */
  private bounds: RingBounds | null = null;
  private ringReady: Promise<void>;
  private ropes: RingRopes | null = null;
  /** Extents of the whole ring, used to frame the fixed camera. */
  private ringFrame: {
    centre: Vector3;
    halfWidth: number;
    halfHeight: number;
    halfDepth: number;
  } | null = null;
  /** Meshes and materials belonging to the current character, for disposal. */
  private loadedNodes: TransformNode[] = [];
  private opponent: Opponent | null = null;
  private opponentNodes: TransformNode[] = [];

  /** Fixed-rate clock the combat simulation advances on. */
  private readonly clock = new FixedStep();
  private readonly inputBuffer = new InputBuffer();
  private match: MayQuvMatch | null = null;
  private playerMoveset: FighterMoveset | null = null;
  private botBrain: BotBrain | null = null;

  private readonly onResize: () => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { stencil: true }, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.53, 0.69, 0.84, 1);

    this.camera = this.createCamera();
    this.shadows = this.createLighting();
    this.createGround();
    this.input = new InputController(this.scene);
    if (import.meta.env.DEV) this.collisionDebug = new CollisionDebugView(this.scene);
    // A missing or malformed ring must not stop the match starting; the
    // controller falls back to a flat arena when bounds are unavailable.
    this.ringReady = this.loadRing().catch((err) => {
      console.warn("Ring failed to load, using flat arena:", err);
    });

    this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.engine.getDeltaTime() / 1000;

      // Presentation runs at display rate...
      const gamepadFrame = this.gamepadTechnique.update();
      for (const button of gamepadFrame.buttons) {
        this.tryMovesetButton(button);
      }
      if (gamepadFrame.clinchToggle && this.match) {
        const position = this.match.player.positionId;
        const clinchPositions = new Set([
          "single_collar_tie",
          "thai_plum",
          "over_under",
          "double_underhooks",
          "rear_clinch",
          "front_headlock",
        ]);

        if (position === "seated_guard") {
          this.technicalStandup("player");
        } else if (clinchPositions.has(position)) {
          this.exitClinch();
        } else {
          this.tryEnterClinch("over_under");
        }
      }

      if (this.match) {
        this.controller?.setConditionMovementScale(
          regionConsequences(this.match.player.condition).movementScale
        );
      }
      this.controller?.update(dt);
      this.defensiveOverlay?.apply(
        this.input.swayHorizontal,
        this.input.swayVertical
      );
      const botDefense = this.botBrain?.defenseState(this.clock.frame);
      this.opponentDefensiveOverlay?.apply(
        botDefense?.evasion.horizontal ?? 0,
        botDefense?.evasion.vertical ?? 0
      );
      const opponentPosition = this.match?.opponent.positionId ?? "standing_open";
      const botPressure =
        opponentPosition === "standing_open" ||
        opponentPosition === "standing_close";
      this.opponent?.update(
        dt,
        this.playerRoot?.position ?? null,
        botPressure ? 1.0 : null,
        this.match
          ? regionConsequences(this.match.opponent.condition).movementScale
          : 1
      );
      // Ropes keep oscillating after the wrestler has left them.
      this.ropes?.update(dt);
      this.collisionDebug?.update(this.playerCollision, this.opponentCollision);

      // ...while combat advances on a fixed clock, so hit frames and reversal
      // windows are counted in equal, reproducible steps.
      this.clock.advance(dt, (frame) => {
        this.botBrain?.step(frame);
        this.match?.step(frame);
        this.inputBuffer.prune(frame);
      });
    });

    this.engine.runRenderLoop(() => this.scene.render());

    this.onResize = () => {
      this.engine.resize();
      // The framing distance depends on the aspect ratio, so re-solve it.
      this.frameRing();
    };
    window.addEventListener("resize", this.onResize);

    if (import.meta.env.DEV) {
      // Handle for automated smoke tests to inspect live state.
      (window as unknown as Record<string, unknown>).__game = this;
    }
  }

  /** Name of the animation clip currently blended in. Used by tests. */
  get currentAnimation(): string | null {
    return this.animations?.current ?? null;
  }

  get playerRigBones(): string[] {
    return this.playerRig?.resolvedBoneIds ?? [];
  }

  get playerRigUnresolvedBones(): string[] {
    return this.playerRig?.unresolvedBoneIds ?? [];
  }

  setCollisionDebug(enabled: boolean): void {
    this.collisionDebug?.setEnabled(enabled);
  }

  get collisionDebugEnabled(): boolean {
    return this.collisionDebug?.isEnabled ?? false;
  }

  playDebugThrow(id: "osoto_gari" | "harai_goshi" | "seoi_nage"): boolean {
    const group = this.pairedProcedural?.buildThrow(id);
    if (!group || !this.animations) return false;
    this.animations.register(group);
    this.animations.play(group.name, { loop: false, restart: true });
    return true;
  }

  tryEnterClinch(position: ClinchPoseId = "over_under"): boolean {
    if (!this.match || !this.playerRoot || !this.opponent) return false;
    const dx = this.opponent.position.x - this.playerRoot.position.x;
    const dz = this.opponent.position.z - this.playerRoot.position.z;
    if (Math.hypot(dx, dz) > 1.05) return false;

    if (!this.match.enterClinch("player", position)) return false;

    const group = this.clinchProcedural?.build(position);
    if (group && this.animations) {
      this.clinchProcedural?.alignRoots();
      this.controller?.setExternalPoseLock(true);
      this.opponent.setExternalPoseLock(true);
      this.animations.register(group);
      this.currentClinchPose = position;
      this.animations.play(group.name, { loop: true, restart: true });
    }
    return true;
  }

  exitClinch(): boolean {
    const exited = this.match?.exitClinch() ?? false;
    if (!exited) return false;

    this.currentClinchPose = null;
    this.controller?.setExternalPoseLock(false);
    this.opponent?.setExternalPoseLock(false);
    return true;
  }

  forfeitPlayer(): boolean {
    return this.match?.forfeit("player") ?? false;
  }

    technicalStandup(side: CombatSide = "player"): boolean {
    const stood = this.match?.requestTechnicalStandup(side) ?? false;
    if (stood && side === "opponent") {
      this.opponent?.playReaction("STATE_TECHNICAL_STANDUP");
    }
    return stood;
  }

  private resumeClinchPose(): void {
    if (!this.currentClinchPose || !this.animations) return;
    const group = this.clinchProcedural?.build(this.currentClinchPose);
    if (!group) return;
    this.animations.register(group);
    this.animations.play(group.name, { loop: true, restart: true });
  }

  setPlayerMoveset(moveset: FighterMoveset): boolean {
    if (!this.match) return false;
    if (moveset.styleId !== this.match.player.loadout.styleId) return false;

    const validation = validateMoveset(moveset);
    if (!validation.valid) return false;

    this.playerMoveset = {
      ...moveset,
      slots: { ...moveset.slots },
    };
    return true;
  }

  get currentPlayerMoveset(): FighterMoveset | null {
    return this.playerMoveset
      ? { ...this.playerMoveset, slots: { ...this.playerMoveset.slots } }
      : null;
  }

  tryMovesetButton(button: MovesetButton): boolean {
    if (!this.match || !this.playerMoveset) return false;
    const techniqueId = techniqueForMovesetInput(
      this.playerMoveset,
      this.match.player.positionId,
      button
    );
    return techniqueId ? this.tryPlayerTechnique(techniqueId) : false;
  }

    private tryOpponentTechnique(techniqueId: string): boolean {
    if (!this.match || !this.opponent) return false;

    const technique = techniqueById(techniqueId);
    if (!technique) return false;

    let animationName: string | null = null;

    if (
      techniqueId === "osoto_gari" ||
      techniqueId === "harai_goshi" ||
      techniqueId === "seoi_nage" ||
      techniqueId === "inside_trip" ||
      techniqueId === "outside_trip" ||
      techniqueId === "body_lock_trip" ||
      techniqueId === "double_leg" ||
      techniqueId === "single_leg" ||
      techniqueId === "high_crotch"
    ) {
      const group = this.opponentPairedProcedural?.buildThrow(techniqueId);
      if (group) {
        this.opponent.registerAnimations([group]);
        animationName = group.name;
      }
    } else {
      const styleId = this.match.opponent.loadout.styleId;
      const styleRecord = styleById(styleId);
      const familyText = [styleId, ...(styleRecord?.family ?? [])]
        .join(" ")
        .toLowerCase();
      const preferredMotionFamily =
        familyText.includes("muay") ? "muay_thai" :
        familyText.includes("taekwondo") ? "taekwondo" :
        familyText.includes("karate") ? "karate" :
        familyText.includes("boxing") ? "boxing" :
        undefined;

      const group = this.opponentProcedural?.buildTechnique(
        techniqueId,
        preferredMotionFamily
      );
      if (group) {
        this.opponent.registerAnimations([group]);
        animationName = group.name;
      }
    }

    const relativeVelocityMps =
      technique.weapon.includes("leg") || technique.weapon.includes("knee")
        ? 8.0
        : technique.weapon.includes("elbow")
          ? 7.0
          : 6.2;

    const queued = this.match.throwTechnique(
      "opponent",
      technique,
      this.clock.frame,
      {
        relativeVelocityMps,
        contactQuality: "clean",
        guard: "none",
      }
    );

    if (!queued) return false;
    if (animationName) {
      if (this.currentClinchPose && this.animations) {
        const group =
          this.opponentProcedural?.buildTechnique(techniqueId) ??
          (techniqueId === "osoto_gari" ||
          techniqueId === "harai_goshi" ||
          techniqueId === "seoi_nage" ||
          techniqueId === "inside_trip" ||
          techniqueId === "outside_trip" ||
          techniqueId === "body_lock_trip" ||
          techniqueId === "double_leg" ||
          techniqueId === "single_leg" ||
          techniqueId === "high_crotch"
            ? this.opponentPairedProcedural?.buildThrow(techniqueId)
            : null);
        if (group) {
          this.animations.register(group);
          this.animations.play(group.name, {
            loop: false,
            restart: true,
            onEnd: () => this.resumeClinchPose(),
          });
        }
      } else {
        this.opponent.playReaction(animationName);
      }
    }
    return true;
  }

    tryPlayerTechnique(techniqueId: string): boolean {
    if (!this.match || !this.animations) return false;
    const technique = techniqueById(techniqueId);
    if (!technique) return false;

    const playerStyle = this.match.player.loadout.styleId;
    const styleRecord = styleById(playerStyle);
    const familyText = [playerStyle, ...(styleRecord?.family ?? [])]
      .join(" ")
      .toLowerCase();
    const preferredMotionFamily =
      familyText.includes("muay") ? "muay_thai" :
      familyText.includes("taekwondo") ? "taekwondo" :
      familyText.includes("karate") ? "karate" :
      familyText.includes("boxing") ? "boxing" :
      undefined;

    let animationName: string | null = null;

    if (
      techniqueId === "osoto_gari" ||
      techniqueId === "harai_goshi" ||
      techniqueId === "seoi_nage" ||
      techniqueId === "inside_trip" ||
      techniqueId === "outside_trip" ||
      techniqueId === "body_lock_trip" ||
      techniqueId === "double_leg" ||
      techniqueId === "single_leg" ||
      techniqueId === "high_crotch"
    ) {
      const group = this.pairedProcedural?.buildThrow(techniqueId);
      if (group) {
        this.animations.register(group);
        animationName = group.name;
      }
    } else {
      const group = this.playerProcedural?.buildTechnique(
        techniqueId,
        preferredMotionFamily
      );
      if (group) {
        this.animations.register(group);
        animationName = group.name;
      }
    }

    const relativeVelocityMps =
      technique.weapon.includes("leg") || technique.weapon.includes("knee")
        ? 8.0
        : technique.weapon.includes("elbow")
          ? 7.0
          : 6.2;

    const queued = this.match.throwTechnique(
      "player",
      technique,
      this.clock.frame,
      {
        relativeVelocityMps,
        contactQuality: "clean",
        guard: "none",
      }
    );

    if (!queued) return false;

    if (animationName) {
      const returnToClinch = this.currentClinchPose !== null;
      this.animations.play(animationName, {
        loop: false,
        restart: true,
        onEnd: () => {
          if (returnToClinch) this.resumeClinchPose();
        },
      });
    }

    this.inputBuffer.press("strike", this.clock.frame);
    this.inputBuffer.release("strike", this.clock.frame);
    return true;
  }

  /** Player world position. Used by tests. */
  get playerPosition(): { x: number; y: number; z: number } | null {
    if (!this.playerRoot) return null;
    const p = this.playerRoot.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  /** Live position vector, so tests can reposition the player. */
  get playerPositionRef(): Vector3 | null {
    return this.playerRoot?.position ?? null;
  }

  /** Play area derived from the ring. Used by tests. */
  get ringBounds(): RingBounds | null {
    return this.bounds;
  }

  /** Rope springs. Used by tests. */
  get ringRopes(): RingRopes | null {
    return this.ropes;
  }

  /** Current horizontal speed, for tests and future HUD readouts. */
  get playerSpeed(): number {
    return this.controller?.currentSpeed ?? 0;
  }

  /** Facing in radians. Used by tests. */
  get playerFacing(): number {
    return this.controller?.facing ?? 0;
  }

  /** Opponent world position, or null if none is loaded. Used by tests. */
  get opponentPosition(): { x: number; y: number; z: number } | null {
    if (!this.opponent) return null;
    const p = this.opponent.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  /** Opponent facing in radians. Used by tests. */
  get opponentFacing(): number {
    return this.opponent?.root.rotation.y ?? 0;
  }

  /**
   * Places the wrestler at a spot and facing, clearing momentum. Used by
   * tests now and by match resets later.
   */
  teleportPlayer(x: number, z: number, yaw?: number): void {
    if (!this.playerRoot || !this.controller) return;
    this.playerRoot.position.set(x, 0, z);
    this.controller.resetMotion();
    if (yaw !== undefined) this.controller.setFacing(yaw);
  }

  /**
   * A fixed ringside camera. It never moves, never follows and cannot be
   * orbited - the whole match is played out in one framing, the way the
   * 1990s wrestling games did it.
   *
   * Note this also makes the controls stable: movement is camera-relative,
   * and with the camera pinned, "W" is always the same direction on screen.
   */
  private createCamera(): ArcRotateCamera {
    // ArcRotate is used purely as a convenient way to express "sit at this
    // angle and distance, looking here". No control is attached to it.
    const camera = new ArcRotateCamera(
      "ringsideCamera",
      -Math.PI / 2,
      RING_VIEW.beta,
      12,
      new Vector3(0, RING_VIEW.lookHeight, 0),
      this.scene
    );
    return camera;
  }

  /**
   * Pulls the camera back far enough to hold the whole ring in frame.
   *
   * The distance is solved from the viewport rather than hard-coded, so the
   * ring stays fully visible on any aspect ratio.
   */
  private frameRing(): void {
    if (!this.ringFrame) return;

    const { centre, halfWidth, halfHeight, halfDepth } = this.ringFrame;
    const vFov = this.camera.fov;
    const aspect = this.engine.getAspectRatio(this.camera) || 1;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

    const margin = RING_VIEW.margin;
    const forHeight = (halfHeight * margin) / Math.tan(vFov / 2);
    const forWidth = (halfWidth * margin) / Math.tan(hFov / 2);

    // Target first: setTarget re-derives alpha/beta/radius from the camera's
    // current position, so setting them beforehand would be thrown away.
    this.camera.setTarget(
      new Vector3(centre.x, centre.y + RING_VIEW.lookHeight, centre.z)
    );

    this.camera.alpha = -Math.PI / 2;
    this.camera.beta = RING_VIEW.beta;
    // Add the ring's own depth: the far side has to fit too.
    this.camera.radius = Math.max(forHeight, forWidth) + halfDepth;
  }

  private createLighting(): ShadowGenerator {
    const hemi = new HemisphericLight(
      "hemiLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    hemi.intensity = 0.55;
    hemi.groundColor = new Color3(0.3, 0.32, 0.36);

    const sun = new DirectionalLight(
      "sun",
      new Vector3(-0.6, -1, 0.4),
      this.scene
    );
    sun.position = new Vector3(12, 20, -12);
    sun.intensity = 1.6;

    const shadows = new ShadowGenerator(1024, sun);
    shadows.useBlurExponentialShadowMap = true;
    shadows.blurKernel = 24;
    return shadows;
  }

  private createGround(): Mesh {
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: Tuning.groundSize, height: Tuning.groundSize },
      this.scene
    );

    const material = new StandardMaterial("groundMat", this.scene);
    material.diffuseColor = new Color3(0.14, 0.13, 0.16);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    ground.material = material;
    ground.receiveShadows = true;
    // Arena floor sits below the ring; the exact drop is set once the ring
    // has loaded and its apron height is known.
    ground.position.y = -1.6;
    this.arenaFloor = ground;
    return ground;
  }

  /**
   * Loads the ring, moves it so the mat sits at y=0 centred on the origin,
   * and derives the play area from the rope meshes.
   *
   * Bounds are measured from the geometry rather than hard-coded so a
   * different ring model drops in without touching this code.
   */
  private async loadRing(): Promise<void> {
    const result = await ImportMeshAsync(RING.file, this.scene);

    const root = new TransformNode("ringRoot", this.scene);
    for (const mesh of result.meshes) {
      if (!mesh.parent) mesh.parent = root;
    }

    const meshes = result.meshes.filter(
      (m) => m instanceof Mesh && m.getTotalVertices() > 0
    ) as Mesh[];
    for (const m of meshes) {
      m.refreshBoundingInfo();
      m.receiveShadows = true;
    }

    const canvas = meshes.find((m) => m.name.includes(RING.canvasMesh));
    const ropes = meshes.filter((m) => m.name.startsWith(RING.ropePrefix));

    if (!canvas || !ropes.length) {
      // Without the expected meshes, leave the ring where it is and fall back
      // to a bare arena so the game still plays.
      console.warn("Ring meshes not found; skipping ring alignment");
      return;
    }

    // Drop the mat to y=0 and centre it, so the character controller can keep
    // treating the standing surface as y=0.
    const cb = canvas.getBoundingInfo().boundingBox;
    const offset = new Vector3(
      -(cb.minimumWorld.x + cb.maximumWorld.x) / 2,
      -cb.maximumWorld.y,
      -(cb.minimumWorld.z + cb.maximumWorld.z) / 2
    );
    root.position.addInPlace(offset);
    root.computeWorldMatrix(true);

    // Whole-ring extents, including posts, so the camera can frame it.
    let ringMinX = Infinity, ringMaxX = -Infinity;
    let ringMinY = Infinity, ringMaxY = -Infinity;
    let ringMinZ = Infinity, ringMaxZ = -Infinity;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let topRopeY = 0;
    let apronBottom = Infinity;
    for (const rope of ropes) {
      rope.computeWorldMatrix(true);
      rope.refreshBoundingInfo();
      const b = rope.getBoundingInfo().boundingBox;
      minX = Math.min(minX, b.minimumWorld.x);
      maxX = Math.max(maxX, b.maximumWorld.x);
      minZ = Math.min(minZ, b.minimumWorld.z);
      maxZ = Math.max(maxZ, b.maximumWorld.z);
      // The highest rope is the one wrestlers stand on.
      topRopeY = Math.max(topRopeY, b.centerWorld.y);
    }
    for (const m of meshes) {
      m.computeWorldMatrix(true);
      const b = m.getBoundingInfo().boundingBox;
      apronBottom = Math.min(apronBottom, b.minimumWorld.y);
      ringMinX = Math.min(ringMinX, b.minimumWorld.x);
      ringMaxX = Math.max(ringMaxX, b.maximumWorld.x);
      ringMinY = Math.min(ringMinY, b.minimumWorld.y);
      ringMaxY = Math.max(ringMaxY, b.maximumWorld.y);
      ringMinZ = Math.min(ringMinZ, b.minimumWorld.z);
      ringMaxZ = Math.max(ringMaxZ, b.maximumWorld.z);
    }

    this.ringFrame = {
      centre: new Vector3(
        (ringMinX + ringMaxX) / 2,
        (ringMinY + ringMaxY) / 2,
        (ringMinZ + ringMaxZ) / 2
      ),
      halfWidth: (ringMaxX - ringMinX) / 2,
      halfHeight: (ringMaxY - ringMinY) / 2,
      halfDepth: (ringMaxZ - ringMinZ) / 2,
    };
    this.frameRing();

    const r = Tuning.bodyRadius;
    this.bounds = {
      minX: minX + r,
      maxX: maxX - r,
      minZ: minZ + r,
      maxZ: maxZ - r,
      topRopeY,
    };

    // Ring centre in world terms, so each rope knows which way is outward.
    const centre = new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.ropes = new RingRopes(ropes, centre, this.scene);

    this.controller?.setBounds(this.bounds);
    this.controller?.setRopes(this.ropes);

    if (this.arenaFloor && Number.isFinite(apronBottom)) {
      this.arenaFloor.position.y = apronBottom;
    }
  }

  /**
   * Loads (or replaces) the playable character. Resolves once the model and
   * its clips are ready and the controller is live.
   */
  /**
   * Loads one wrestler: mesh under a node we own, skin tone applied, clips
   * wrapped in an AnimationController.
   */
  private async loadWrestler(
    definition: CharacterDefinition,
    nodeName: string,
    spawn: { x: number; z: number }
  ): Promise<{
    root: TransformNode;
    animations: AnimationController;
    procedural: ProceduralMartialAnimator;
    stanceProcedural: ProceduralStanceAnimator;
    rig: SkeletonRig;
    nodes: TransformNode[];
  }> {
    const result = await ImportMeshAsync(
      MODEL_ROOT + definition.file,
      this.scene
    );

    // A parent node we own, so movement never fights the glTF's own transforms.
    const root = new TransformNode(nodeName, this.scene);
    root.position = new Vector3(spawn.x, 0, spawn.z);

    const nodes: TransformNode[] = [];
    for (const mesh of result.meshes) {
      if (!mesh.parent) {
        mesh.parent = root;
        nodes.push(mesh);
      }
      mesh.receiveShadows = true;
      if (mesh instanceof Mesh && mesh.getTotalVertices() > 0) {
        this.shadows.addShadowCaster(mesh);
      }
    }

    // Scope the material lookup to this wrestler's own meshes: both are in
    // the scene at once, and searching globally could hit the other one.
    this.applySkinTone(definition, result.meshes);

    const animations = new AnimationController(result.animationGroups);
    const rig = new SkeletonRig(result.skeletons);
    const procedural = new ProceduralMartialAnimator(this.scene, rig);
    const stanceProcedural = new ProceduralStanceAnimator(this.scene, rig);
    animations.registerMany(procedural.buildDefaultSet());

    if (import.meta.env.DEV) {
      console.info(
        `[${nodeName}] rig bones:`,
        rig.resolvedBoneIds,
        "unresolved:",
        rig.unresolvedBoneIds
      );
    }

    return {
      root,
      animations,
      procedural,
      stanceProcedural,
      rig,
      nodes,
    };
  }

  async loadCharacter(definition: CharacterDefinition): Promise<string[]> {
    this.disposeCharacter();

    // The ring defines the play area, so it must be measured before the
    // controller starts clamping and rebounding against it.
    await this.ringReady;

    const player = await this.loadWrestler(
      definition,
      "playerRoot",
      SPAWN.player
    );
    const root = player.root;
    this.loadedNodes.push(...player.nodes);
    this.animations = player.animations;
    this.playerProcedural = player.procedural;
    this.playerStanceProcedural = player.stanceProcedural;
    this.playerRig = player.rig;
    this.defensiveOverlay = new DefensivePoseOverlay(player.rig);
    this.playerReactions = new ProceduralHitReactionAnimator(this.scene, player.rig);
    this.animations.registerMany(this.playerReactions.buildAll());
    this.playerKnockdown = new ProceduralKnockdownAnimator(this.scene, player.rig);
    const playerKnockdownClip = this.playerKnockdown.buildKnockdown();
    const playerStandupClip = this.playerKnockdown.buildTechnicalStandup();
    const playerKoClip = this.playerKnockdown.buildKnockout();
    this.animations.registerMany(
      [playerKnockdownClip, playerStandupClip, playerKoClip].filter(
        (x): x is NonNullable<typeof x> => Boolean(x)
      )
    );

    // The opponent is inert for now; it exists so the player has someone to
    // square up to.
    const opponentDef = opponentFor(definition);
    const other = await this.loadWrestler(
      opponentDef,
      "opponentRoot",
      SPAWN.opponent
    );
    this.opponent = new Opponent(other.root, other.animations);
    this.opponentNodes = other.nodes;
    this.opponentRig = other.rig;
    this.opponentProcedural = other.procedural;
    this.opponentDefensiveOverlay = new DefensivePoseOverlay(other.rig);
    this.opponentReactions = new ProceduralHitReactionAnimator(this.scene, other.rig);
    this.opponent.registerAnimations(this.opponentReactions.buildAll());
    this.opponentKnockdown = new ProceduralKnockdownAnimator(this.scene, other.rig);
    const knockdownClip = this.opponentKnockdown.buildKnockdown();
    const standupClip = this.opponentKnockdown.buildTechnicalStandup();
    const opponentKoClip = this.opponentKnockdown.buildKnockout();
    this.opponent.registerAnimations(
      [knockdownClip, standupClip, opponentKoClip].filter(
        (x): x is NonNullable<typeof x> => Boolean(x)
      )
    );

    if (this.playerRig && this.opponentRig) {
      this.pairedProcedural = new PairedMartialAnimator(
        this.scene,
        root,
        this.playerRig,
        other.root,
        this.opponentRig
      );
      this.opponentPairedProcedural = new PairedMartialAnimator(
        this.scene,
        other.root,
        this.opponentRig,
        root,
        this.playerRig
      );
      this.clinchProcedural = new ProceduralClinchAnimator(
        this.scene,
        root,
        this.playerRig,
        other.root,
        this.opponentRig
      );
      this.grappleDefenseProcedural = new ProceduralGrappleDefenseAnimator(
        this.scene,
        other.root,
        this.opponentRig,
        root,
        this.playerRig
      );
      this.opponentGrappleDefenseProcedural = new ProceduralGrappleDefenseAnimator(
        this.scene,
        root,
        this.playerRig,
        other.root,
        this.opponentRig
      );
      for (const id of [
        "osoto_gari",
        "harai_goshi",
        "seoi_nage",
        "inside_trip",
        "outside_trip",
        "body_lock_trip",
        "double_leg",
        "single_leg",
        "high_crotch",
      ] as const) {
        const group = this.pairedProcedural.buildThrow(id);
        if (group) this.animations.register(group);
      }
    }

    const missing = REQUIRED_CLIPS.filter((c) => !this.animations!.has(c));

    this.playerRoot = root;
    this.controller = new CharacterController(
      root,
      this.animations,
      this.input,
      this.camera,
      this.bounds,
      this.ropes
    );
    // Facing and default runs both key off where the opponent is.
    this.controller.opponentPosition = () => this.opponent?.position ?? null;
    this.controller.setFacing(Math.atan2(0, SPAWN.opponent.z - SPAWN.player.z));

    this.startMatch(definition.id, opponentDef.id);

    // The camera is deliberately not re-aimed at the character: it stays on
    // the ring for the whole match.
    return missing;
  }

  private fighterLoadout(characterId: string, side: CombatSide): FighterLoadout {
    const styleCycle = ["boxing", "combat_sambo", "judo", "american_kickboxing"];
    const index = Math.abs(
      [...characterId].reduce((n, ch) => n + ch.charCodeAt(0), 0)
    ) % styleCycle.length;
    const styleId = styleCycle[index];
    const style = styleById(styleId);
    const massKg = side === "player" ? 77 : 82;
    const heightM = side === "player" ? 1.78 : 1.82;

    return {
      id: characterId,
      name: characterId,
      styleId,
      stanceId: style?.default_stance ?? "neutral_fighting",
      body: {
        massKg,
        heightM,
        reachM: heightM * 1.02,
        centerOfMassHeightRatio: 0.56,
      },
    };
  }

  /**
   * Opens a new match: fresh health, stamina and RNG for both wrestlers, and
   * the strike inputs wired through to the damage engine.
   */
  private startMatch(playerId: string, opponentId: string): void {
    this.clock.reset();
    this.inputBuffer.clear();

    const player = this.fighterLoadout(playerId, "player");
    const opponent = this.fighterLoadout(opponentId, "opponent");
    this.match = new MayQuvMatch(player, opponent);
    this.playerMoveset = listMovesets(player.styleId)[0] ?? createDefaultMoveset(player.styleId);
    this.botBrain = new BotBrain(
      this.match,
      "opponent",
      "club",
      (techniqueId) => this.tryOpponentTechnique(techniqueId),
      () => {
        if (!this.playerRoot || !this.opponent || !this.match) return false;
        const dx = this.playerRoot.position.x - this.opponent.position.x;
        const dz = this.playerRoot.position.z - this.opponent.position.z;
        if (Math.hypot(dx, dz) > 1.05) return false;
        return this.match.enterClinch("opponent", "over_under");
      }
    );
    this.playerCollision = this.playerRig ? new FighterCollisionRig(this.playerRig, player.body.heightM) : null;
    this.opponentCollision = this.opponentRig ? new FighterCollisionRig(this.opponentRig, opponent.body.heightM) : null;

    this.match.canConnect = (attacker: CombatSide) =>
      this.inStrikeRange(attacker);

    this.match.guardState = (side) => {
      const requested =
        side === "player"
          ? this.input.guarding
            ? "solid"
            : "none"
          : this.botBrain?.defenseState(this.clock.frame).guard
            ? "solid"
            : "none";
      return guardLevelFromArmCondition(
        this.match!.stateOf(side).condition,
        requested
      );
    };

    this.match.evasionState = (side) => {
      if (side === "player") {
        return {
          horizontal: this.input.swayHorizontal,
          vertical: this.input.swayVertical,
        };
      }
      return (
        this.botBrain?.defenseState(this.clock.frame).evasion ?? {
          horizontal: 0,
          vertical: 0,
        }
      );
    };

    this.match.grappleDefenseState = (side) => {
      if (side === "player") {
        if (!this.input.grappleDefense) {
          return { sprawl: false, whizzer: false };
        }
        return {
          sprawl: this.input.swayVertical <= -0.35,
          whizzer:
            Math.abs(this.input.swayHorizontal) >= 0.35 &&
            canSustainWhizzer(this.match!.player.condition),
        };
      }

      const bot = this.botBrain?.defenseState(this.clock.frame).grapple ?? {
        sprawl: false,
        whizzer: false,
      };
      return {
        sprawl: bot.sprawl,
        whizzer:
          bot.whizzer &&
          canSustainWhizzer(this.match!.opponent.condition),
      };
    };

    this.match.contactRegion = (attacker, technique) => {
      const attackRig = attacker === "player" ? this.playerCollision : this.opponentCollision;
      const defendRig = attacker === "player" ? this.opponentCollision : this.playerCollision;
      if (!attackRig || !defendRig) return null;

      const weapon = technique.weapon;
      let strike = null;
      if (weapon.includes("lead_hand")) strike = attackRig.handStrike("left");
      else if (weapon.includes("rear_hand") || weapon === "hand") strike = attackRig.handStrike("right");
      else if (weapon.includes("lead_elbow")) strike = attackRig.elbowStrike("left");
      else if (weapon.includes("rear_elbow") || weapon === "elbow") strike = attackRig.elbowStrike("right");
      else if (weapon.includes("lead_knee")) strike = attackRig.kneeStrike("left");
      else if (weapon.includes("rear_knee") || weapon === "knee") strike = attackRig.kneeStrike("right");
      else if (weapon.includes("lead_leg")) strike = attackRig.footStrike("left");
      else if (weapon.includes("rear_leg") || weapon === "leg") strike = attackRig.footStrike("right");
      else if (weapon === "head") strike = attackRig.headStrike();
      else if (weapon === "arm" || weapon === "arms") strike = attackRig.handStrike("right");
      else return null;

      if (!strike) return null;
      return firstHitRegion(strike, defendRig.hurtVolumes());
    };

    this.match.onResolved = (_attacker, defender, resolution) => {
      if (resolution.knockedOut) {
        if (defender === "player") {
          this.controller?.setExternalPoseLock(true);
          this.animations?.play("STATE_KNOCKOUT", {
            loop: false,
            restart: true,
          });
        } else {
          this.opponent?.setExternalPoseLock(true);
          this.opponent?.playReaction("STATE_KNOCKOUT");
        }
        return;
      }

      if (resolution.knockedDown) return;

      const clip = `REACT_${resolution.targetRegion}`;
      if (defender === "player") {
        this.animations?.play(clip, { loop: false, restart: true });
      } else {
        this.opponent?.playReaction(clip);
      }
    };

    this.match.onGroundedWindowChanged = (side, active) => {
      const clip = active
        ? "STATE_KNOCKDOWN_SEATED"
        : "STATE_TECHNICAL_STANDUP";

      if (side === "player") {
        if (!this.animations) return;
        if (active) {
          this.controller?.setExternalPoseLock(true);
          this.animations.play(clip, { loop: false, restart: true });
        } else {
          this.animations.play(clip, {
            loop: false,
            restart: true,
            onEnd: () => this.controller?.setExternalPoseLock(false),
          });
        }
        return;
      }

      this.opponent?.playReaction(clip);
    };

    this.match.onFinished = (_finish, _winner) => {
      this.controller?.setExternalPoseLock(true);
      this.opponent?.setExternalPoseLock(true);
    };

    this.match.onDefended = (defender, kind) => {
      if (kind === "evade" || !this.animations) return;

      const source =
        defender === "player"
          ? this.grappleDefenseProcedural
          : this.opponentGrappleDefenseProcedural;
      const group = source?.build(kind === "sprawl" ? "sprawl" : "whizzer");
      if (!group) return;

      this.controller?.setExternalPoseLock(true);
      this.opponent?.setExternalPoseLock(true);
      this.animations.register(group);
      this.animations.play(group.name, {
        loop: false,
        restart: true,
        onEnd: () => {
          this.controller?.setExternalPoseLock(false);
          this.opponent?.setExternalPoseLock(false);
          if (this.currentClinchPose) this.resumeClinchPose();
        },
      });
    };

    this.match.onPositionChanged = (playerPosition, opponentPosition) => {
      if (playerPosition !== opponentPosition) return;
      const supported = new Set<ClinchPoseId>([
        "single_collar_tie",
        "thai_plum",
        "over_under",
        "double_underhooks",
        "front_headlock",
      ]);
      if (!supported.has(playerPosition as ClinchPoseId)) return;

      const pose = playerPosition as ClinchPoseId;
      const group = this.clinchProcedural?.build(pose);
      if (!group || !this.animations) return;

      this.currentClinchPose = pose;
      this.clinchProcedural?.alignRoots();
      this.controller?.setExternalPoseLock(true);
      this.opponent?.setExternalPoseLock(true);
      this.animations.register(group);
      this.animations.play(group.name, { loop: true, restart: true });
    };

    const movement = deriveMovementPhysics(player.body, player.stanceId);
    this.controller?.setMovementPhysics({
      walkSpeed: movement.walkSpeed,
      runSpeed: movement.runSpeed,
      acceleration: movement.acceleration,
      pivotScale: movement.pivotScale,
    });

    const preferredPoseId = preferredBiomechPoseForStyle(player.styleId);
    const stanceGroup = preferredPoseId
      ? this.playerStanceProcedural?.buildPose(preferredPoseId)
      : null;
    if (stanceGroup && this.animations) {
      this.animations.register(stanceGroup);
      this.controller?.setIdleClip(stanceGroup.name);
    } else {
      this.controller?.setIdleClip(null);
    }

    // Legacy animation buttons are translated into real MAY' QUV techniques
    // while the animation library is replaced incrementally.
    const styleRecord = styleById(player.styleId);
    const familyText = [player.styleId, ...(styleRecord?.family ?? [])]
      .join(" ")
      .toLowerCase();
    const preferredMotionFamily =
      familyText.includes("muay") ? "muay_thai" :
      familyText.includes("taekwondo") ? "taekwondo" :
      familyText.includes("karate") ? "karate" :
      familyText.includes("boxing") ? "boxing" :
      undefined;

    this.controller?.setTechniqueClipResolver((moveId) => {
      const techniqueId =
        moveId === "weak-arm-strike-1" ? "cross" : "round_kick_body";
      const group = this.playerProcedural?.buildTechnique(
        techniqueId,
        preferredMotionFamily
      );
      if (!group || !this.animations) return null;
      this.animations.register(group);
      return group.name;
    });

    this.controller?.setStrikeHandler((moveId) => {
      if (!this.match) return;
      const techniqueId =
        moveId === "weak-arm-strike-1"
          ? "cross"
          : moveId === "weak-leg-strike-1"
            ? "round_kick_body"
            : "flying_knee";
      const technique = techniqueById(techniqueId);
      if (!technique) return;

      this.inputBuffer.press("strike", this.clock.frame);
      this.inputBuffer.release("strike", this.clock.frame);

      const relativeVelocityMps =
        technique.weapon.includes("leg") || technique.weapon.includes("knee")
          ? 8.0
          : 6.2;

      this.match.throwTechnique(
        "player",
        technique,
        this.clock.frame,
        {
          relativeVelocityMps,
          contactQuality: "clean",
          guard: "none",
        }
      );
    });
  }

  /**
   * Whether an attack can reach: close enough, and roughly facing the target.
   * A wrestler swinging with his back turned should miss.
   */
  private inStrikeRange(attacker: CombatSide): boolean {
    if (!this.playerRoot || !this.opponent) return false;

    const from = attacker === "player" ? this.playerRoot : this.opponent.root;
    const to = attacker === "player" ? this.opponent.root : this.playerRoot;

    const dx = to.position.x - from.position.x;
    const dz = to.position.z - from.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > Tuning.strikeRange) return false;

    // Angle between where the attacker faces and where the target is.
    const toTarget = Math.atan2(dx, dz);
    let delta = (toTarget - from.rotation.y) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return Math.abs(delta) <= Tuning.strikeArc;
  }

  /** Live combat state for the debug overlay. */
  matchSnapshot() {
    return this.match?.snapshot() ?? null;
  }

  movesetSnapshot() {
    if (!this.match || !this.playerMoveset) return null;

    const positionId = this.match.player.positionId;
    const buttons = ["a", "b", "x", "y"] as const;
    const resolved = Object.fromEntries(
      buttons.map((button) => {
        const id = techniqueForMovesetInput(
          this.playerMoveset!,
          positionId,
          button
        );
        return [
          button,
          id
            ? {
                techniqueId: id,
                name: techniqueById(id)?.name ?? id,
              }
            : null,
        ];
      })
    );

    return {
      movesetName: this.playerMoveset.name,
      positionId,
      buttons: resolved,
    };
  }

  /** Simulation frame count. Used by the overlay and tests. */
  get simFrame(): number {
    return this.clock.frame;
  }

  /** Swaps the body albedo texture and tint for the chosen skin tone. */
  private applySkinTone(
    definition: CharacterDefinition,
    meshes: AbstractMesh[]
  ): void {
    // A bespoke character ships its own textures and names no body material,
    // so there is no re-skin to do. Checked before the lookup because an
    // undefined name would otherwise match any unnamed material it met.
    if (!definition.bodyMaterial) return;

    const material = meshes
      .map((m) => m.material)
      .find((m) => m?.name === definition.bodyMaterial);
    if (!(material instanceof PBRMaterial)) return;

    if (definition.tint) {
      const [r, g, b] = definition.tint;
      material.albedoColor = new Color3(r, g, b);
    }

    if (!definition.bodyTexture) return;

    const previous = material.albedoTexture as Texture | null;

    // glTF images are top-left origin, so the loader builds them with
    // invertY false and no V flip. The replacement must match exactly or the
    // skin renders upside-down.
    const texture = new Texture(
      TEXTURE_ROOT + definition.bodyTexture,
      this.scene,
      undefined,
      false
    );

    if (previous) {
      texture.coordinatesIndex = previous.coordinatesIndex;
      texture.wrapU = previous.wrapU;
      texture.wrapV = previous.wrapV;
      texture.uScale = previous.uScale;
      texture.vScale = previous.vScale;
      texture.uOffset = previous.uOffset;
      texture.vOffset = previous.vOffset;
    }

    material.albedoTexture = texture;
    previous?.dispose();
  }

  private disposeCharacter(): void {
    this.pairedProcedural?.dispose();
    this.pairedProcedural = null;
    this.opponentPairedProcedural?.dispose();
    this.opponentPairedProcedural = null;
    this.clinchProcedural?.dispose();
    this.clinchProcedural = null;
    this.grappleDefenseProcedural?.dispose();
    this.grappleDefenseProcedural = null;
    this.opponentGrappleDefenseProcedural?.dispose();
    this.opponentGrappleDefenseProcedural = null;
    this.currentClinchPose = null;
    this.playerProcedural?.dispose();
    this.playerProcedural = null;
    this.opponentProcedural?.dispose();
    this.opponentProcedural = null;
    this.playerStanceProcedural?.dispose();
    this.playerStanceProcedural = null;
    this.defensiveOverlay?.reset();
    this.defensiveOverlay = null;
    this.opponentDefensiveOverlay?.reset();
    this.opponentDefensiveOverlay = null;
    this.playerRig = null;
    this.opponentRig = null;
    this.playerCollision = null;
    this.opponentCollision = null;
    this.playerReactions?.dispose();
    this.playerReactions = null;
    this.opponentReactions?.dispose();
    this.opponentReactions = null;
    this.playerKnockdown?.dispose();
    this.playerKnockdown = null;
    this.opponentKnockdown?.dispose();
    this.opponentKnockdown = null;

    this.animations?.dispose();
    this.animations = null;
    this.controller = null;
    this.playerMoveset = null;
    this.botBrain = null;

    for (const node of this.loadedNodes) {
      node.dispose(false, true);
    }
    this.loadedNodes = [];

    this.playerRoot?.dispose();
    this.playerRoot = null;

    for (const node of this.opponentNodes) {
      node.dispose(false, true);
    }
    this.opponentNodes = [];
    this.opponent?.dispose();
    this.opponent = null;
  }

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
    this.collisionDebug?.dispose();
    this.collisionDebug = null;
    this.disposeCharacter();
    this.input.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
