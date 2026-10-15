import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import GUI from 'lil-gui';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createPaper, updatePaperFrame, LETTER_QUOTES } from '../lib/paper';
import { LoveLetterQuote } from '../data/quotes';
import { loadVATData, VATAnimData } from '../lib/paper-vat';

interface PaperObject {
  mesh: THREE.Mesh;
  positionAttr: THREE.BufferAttribute;
  normalAttr: THREE.BufferAttribute;
  quote: LoveLetterQuote;
  body: CANNON.Body;
  frameIdx: number;
  state: 'closed' | 'opening' | 'open' | 'discarding' | 'grabbed' | 'rolling' | 'posed';
  time: number;
  homePosition: THREE.Vector3;
  homeRotation: THREE.Euler;
  start: any;
  target: any;
  throw: { settleTimer: number } | null;
  grab?: { target: THREE.Vector3 };
  debugSphere?: THREE.Mesh;
}

interface PaperCrumpleSceneProps {
  onLoaded?: () => void;
  onError?: (err: Error) => void;
  onProgress?: (progress: number, stage: string) => void;
  guiVisible?: boolean;
  onToggleGui?: () => void;
  paperCount?: number;
  onPaperCountChange?: (count: number) => void;
  onCardStateChange?: (activeQuote: LoveLetterQuote | null) => void;
  sceneRef?: React.MutableRefObject<{ shakeScene: () => void } | null>;
}

export const PaperCrumpleScene: React.FC<PaperCrumpleSceneProps> = ({
  onLoaded,
  onError,
  onProgress,
  guiVisible = false,
  onToggleGui,
  paperCount: initialPaperCount,
  onPaperCountChange,
  onCardStateChange,
  sceneRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const guiContainerRef = useRef<HTMLDivElement>(null);
  const guiInstanceRef = useRef<GUI | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isDisposed = false;
    const container = containerRef.current;

    const getViewportSize = () => {
      const w = Math.max(window.innerWidth || 1, container.clientWidth || 1, 320);
      const h = Math.max(window.innerHeight || 1, container.clientHeight || 1, 320);
      return { w, h };
    };

    const initialSize = getViewportSize();

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const colorSettings = {
      background: '#38ffc3',
      floor: '#dcdad0',
    };
    scene.background = new THREE.Color(colorSettings.background);

    const cameraSettings = { x: 0, y: 2.2, z: 3.6, targetY: 0.35 };
    const camera = new THREE.PerspectiveCamera(
      40,
      initialSize.w / initialSize.h,
      0.01,
      100
    );
    camera.position.set(cameraSettings.x, cameraSettings.y, cameraSettings.z);
    camera.lookAt(0, cameraSettings.targetY, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initialSize.w, initialSize.h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    // Floor and Wall
    const FLOOR_VISUAL_Y = -0.1;
    const WALL_Z = -1.1;

    const floorMat = new THREE.MeshStandardMaterial({ color: colorSettings.floor, roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_VISUAL_Y, 1);
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({
      color: colorSettings.background,
      roughness: 0.9,
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), wallMat);
    wall.position.set(0, FLOOR_VISUAL_Y + 3, WALL_Z);
    wall.receiveShadow = true;
    scene.add(wall);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
    dirLight.position.set(-2, 2.6, 1.4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -4;
    dirLight.shadow.camera.right = 4;
    dirLight.shadow.camera.top = 4;
    dirLight.shadow.camera.bottom = -3;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 12;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0);
    fillLight.position.set(-2, 1, -1);
    scene.add(fillLight);

    // Post-processing SSAO
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const ssaoPass = new SSAOPass(
      scene,
      camera,
      initialSize.w,
      initialSize.h
    );
    ssaoPass.kernelRadius = 0.01;
    ssaoPass.minDistance = 0.0001;
    ssaoPass.maxDistance = 0.08;
    composer.addPass(ssaoPass);

    composer.addPass(new OutputPass());

    // Parameters & State
    const isPortrait = initialSize.w < initialSize.h;
    const MAX_PAPERS = 80;
    const urlParams = new URLSearchParams(window.location.search);
    const animSettings = { speed: 1.5, openFrame: 4 };
    const defaultCount = isPortrait ? 52 : 46;
    const paperSettings = {
      count: initialPaperCount ?? Math.min(
        MAX_PAPERS,
        Math.max(1, parseInt(urlParams.get('papers') || String(defaultCount), 10))
      ),
    };

    const debugFrameParam = urlParams.get('frame');
    const debugFrame = debugFrameParam !== null ? parseFloat(debugFrameParam) : null;
    const debugPhysics = urlParams.get('debug') === 'physics';
    const ssaoOverride = urlParams.get('ssao');
    if (ssaoOverride !== null && parseFloat(ssaoOverride) <= 0) {
      ssaoPass.enabled = false;
    }

    const papers: PaperObject[] = [];
    let animData: VATAnimData | null = null;
    let activePaper: PaperObject | null = null;

    const PAPER_OFFSETS = isPortrait
      ? [
          [-0.45, 0.02, -0.2],
          [0, 0.02, 0.25],
          [0.45, 0.02, -0.1],
        ]
      : [
          [-1.25, 0.02, -0.1],
          [0, 0.02, 0.12],
          [1.25, 0.02, -0.06],
        ];

    const OPEN_SCREEN_RATIO = 0.78;
    const OPEN_DISTANCE = 1.5;
    const CLOSED_SCALE = 0.82;

    const flatSize = { width: 1, depth: 1.4 };

    // 动态根据屏幕长宽比计算可见舞台范围，避免移动端纸团生成在屏幕两侧之外
    const initialBoundX = isPortrait ? Math.max(1.05, (initialSize.w / initialSize.h) * 2.2) : 2.4;
    const STAGE_BOUNDS = {
      minX: -initialBoundX,
      maxX: initialBoundX,
      minZ: WALL_Z,
      maxZ: isPortrait ? 1.85 : 1.7,
    };

    function updateStageBounds() {
      const curAspect = camera.aspect;
      if (curAspect < 1.0) {
        const boundX = Math.max(1.05, curAspect * 2.2);
        STAGE_BOUNDS.minX = -boundX;
        STAGE_BOUNDS.maxX = boundX;
        STAGE_BOUNDS.maxZ = 1.85;
      } else {
        STAGE_BOUNDS.minX = -2.4;
        STAGE_BOUNDS.maxX = 2.4;
        STAGE_BOUNDS.maxZ = 1.7;
      }
    }
    const OPEN_DURATION = 1.15;
    const DISCARD_DURATION = 1.25;
    const ROLL_LINEAR_RESISTANCE = 2.6;
    const ROLL_ANGULAR_RESISTANCE = 4.5;
    const ROLL_SETTLE_SPEED = 0.018;
    const PHYSICS_STEP = 1 / 60;
    const PAPER_MASS = 0.16;

    const GRAB_LIFT = 0.5;
    const GRAB_STIFFNESS = 14;
    const GRAB_MAX_SPEED = 4.5;
    const THROW_MAX_SPEED = 3.2;
    const CLICK_DRAG_THRESHOLD_PX = 6;

    let collisionRadius = 0.25;
    let restCenterY = FLOOR_VISUAL_Y + 0.25;
    let restMeshY = 0.02;
    const crumpleCenter = new THREE.Vector3(0, 0.2, 0);

    // Cannon.js Physics
    const physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -7.0, 0),
    });
    physicsWorld.allowSleep = false;
    physicsWorld.defaultContactMaterial.friction = 0.8;
    physicsWorld.defaultContactMaterial.restitution = 0.15;

    const paperMaterial = new CANNON.Material('paper');
    const floorPhysicsMaterial = new CANNON.Material('floor');
    physicsWorld.addContactMaterial(
      new CANNON.ContactMaterial(paperMaterial, floorPhysicsMaterial, {
        friction: 1.0,
        restitution: 0.12,
      })
    );
    physicsWorld.addContactMaterial(
      new CANNON.ContactMaterial(paperMaterial, paperMaterial, {
        friction: 0.6,
        restitution: 0.3,
      })
    );

    const floorBody = new CANNON.Body({
      mass: 0,
      material: floorPhysicsMaterial,
      shape: new CANNON.Plane(),
      position: new CANNON.Vec3(0, FLOOR_VISUAL_Y, 0),
      quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
    });
    physicsWorld.addBody(floorBody);

    const _crumpleOffset = new THREE.Vector3();
    function crumpleWorldOffset(scale: number, quaternion: THREE.Quaternion) {
      return _crumpleOffset
        .copy(crumpleCenter)
        .multiplyScalar(scale)
        .applyQuaternion(quaternion);
    }

    function createPaperBody(paper: { mesh: THREE.Mesh }) {
      const off = crumpleWorldOffset(CLOSED_SCALE, paper.mesh.quaternion);
      const body = new CANNON.Body({
        mass: PAPER_MASS,
        material: paperMaterial,
        shape: new CANNON.Sphere(collisionRadius),
        linearDamping: 0.15,
        angularDamping: 0.35,
        position: new CANNON.Vec3(
          paper.mesh.position.x + off.x,
          paper.mesh.position.y + off.y,
          paper.mesh.position.z + off.z
        ),
      });
      body.quaternion.set(
        paper.mesh.quaternion.x,
        paper.mesh.quaternion.y,
        paper.mesh.quaternion.z,
        paper.mesh.quaternion.w
      );
      physicsWorld.addBody(body);
      return body;
    }

    function setPaperBodyDynamic(paper: PaperObject, enabled: boolean) {
      const body = paper.body;
      body.type = enabled ? CANNON.Body.DYNAMIC : CANNON.Body.KINEMATIC;
      body.mass = enabled ? PAPER_MASS : 0;
      body.collisionFilterGroup = enabled ? 1 : 0;
      body.collisionFilterMask = enabled ? 1 : 0;
      if (!enabled) {
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.force.set(0, 0, 0);
        body.torque.set(0, 0, 0);
      }
      body.updateMassProperties();
      body.wakeUp();
    }

    function syncBodyToMesh(paper: PaperObject) {
      const off = crumpleWorldOffset(paper.mesh.scale.x, paper.mesh.quaternion);
      paper.body.position.set(
        paper.mesh.position.x + off.x,
        paper.mesh.position.y + off.y,
        paper.mesh.position.z + off.z
      );
      paper.body.quaternion.set(
        paper.mesh.quaternion.x,
        paper.mesh.quaternion.y,
        paper.mesh.quaternion.z,
        paper.mesh.quaternion.w
      );
    }

    function syncMeshToBody(paper: PaperObject, scale = CLOSED_SCALE) {
      paper.mesh.quaternion.set(
        paper.body.quaternion.x,
        paper.body.quaternion.y,
        paper.body.quaternion.z,
        paper.body.quaternion.w
      );
      const off = crumpleWorldOffset(scale, paper.mesh.quaternion);
      paper.mesh.position.set(
        paper.body.position.x - off.x,
        paper.body.position.y - off.y,
        paper.body.position.z - off.z
      );
      paper.mesh.scale.setScalar(scale);
    }

    function isOnGround(body: CANNON.Body) {
      return body.position.y <= restCenterY + 0.05;
    }

    function applyRollingResistance(body: CANNON.Body, dt: number) {
      const linearDecay = Math.exp(-ROLL_LINEAR_RESISTANCE * dt);
      const angularDecay = Math.exp(-ROLL_ANGULAR_RESISTANCE * dt);
      body.velocity.x *= linearDecay;
      body.velocity.z *= linearDecay;
      body.angularVelocity.x *= angularDecay;
      body.angularVelocity.y *= angularDecay;
      body.angularVelocity.z *= angularDecay;
    }

    function finishRollingPaper(paper: PaperObject, maxFrame: number) {
      if (!animData) return;
      paper.state = 'closed';
      paper.time = 0;
      paper.homePosition.copy(paper.mesh.position);
      paper.homeRotation.copy(paper.mesh.rotation);
      paper.frameIdx = maxFrame;
      updatePaperFrame(paper, animData, paper.frameIdx);
      syncBodyToMesh(paper);
      syncMeshToBody(paper);
    }

    const BOUNDS_PULL = 3.0;
    function applyPhysicsBounds(dt: number) {
      const minX = STAGE_BOUNDS.minX + collisionRadius;
      const maxX = STAGE_BOUNDS.maxX - collisionRadius;
      const minZ = STAGE_BOUNDS.minZ + collisionRadius;
      const maxZ = STAGE_BOUNDS.maxZ - collisionRadius;

      for (const paper of papers) {
        if (!paper.body || paper.body.type !== CANNON.Body.DYNAMIC) continue;
        const body = paper.body;
        if (body.position.x < minX) {
          if (body.velocity.x < 0) {
            body.velocity.x = Math.abs(body.velocity.x) * 0.42;
          }
          body.velocity.x += BOUNDS_PULL * dt;
        } else if (body.position.x > maxX) {
          if (body.velocity.x > 0) {
            body.velocity.x = -Math.abs(body.velocity.x) * 0.42;
          }
          body.velocity.x -= BOUNDS_PULL * dt;
        }

        if (body.position.z < minZ) {
          if (body.velocity.z < 0) {
            body.velocity.z = Math.abs(body.velocity.z) * 0.42;
          }
          body.velocity.z += BOUNDS_PULL * dt;
        } else if (body.position.z > maxZ) {
          if (body.velocity.z > 0) {
            body.velocity.z = -Math.abs(body.velocity.z) * 0.42;
          }
          body.velocity.z -= BOUNDS_PULL * dt;
        }
      }
    }

    function clamp01(value: number) {
      return Math.min(Math.max(value, 0), 1);
    }

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function easeInCubic(t: number) {
      return t * t * t;
    }

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function randomRange(min: number, max: number) {
      return min + Math.random() * (max - min);
    }

    function captureTransform(paper: PaperObject) {
      return {
        position: paper.mesh.position.clone(),
        quaternion: paper.mesh.quaternion.clone(),
        scale: paper.mesh.scale.x,
        frameIdx: paper.frameIdx,
      };
    }

    const _viewDir = new THREE.Vector3();
    function computeOpenPose() {
      camera.getWorldDirection(_viewDir);
      const position = camera.position
        .clone()
        .addScaledVector(_viewDir, OPEN_DISTANCE);

      const yAxis = _viewDir.clone().negate();
      const zAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
      );

      const viewH =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * OPEN_DISTANCE;
      const viewW = viewH * camera.aspect;
      const scale = Math.min(
        (viewH * OPEN_SCREEN_RATIO) / flatSize.depth,
        (viewW * OPEN_SCREEN_RATIO) / flatSize.width
      );

      return { position, quaternion, scale };
    }

    function updateOpenPose() {
      if (!activePaper) return;
      if (activePaper.state === 'opening' && activePaper.target) {
        const pose = computeOpenPose();
        activePaper.target.position.copy(pose.position);
        activePaper.target.quaternion.copy(pose.quaternion);
        activePaper.target.scale = pose.scale;
      } else if (activePaper.state === 'open') {
        const pose = computeOpenPose();
        activePaper.mesh.position.copy(pose.position);
        activePaper.mesh.quaternion.copy(pose.quaternion);
        activePaper.mesh.scale.setScalar(pose.scale);
      }
    }

    function applyCameraSettings() {
      camera.position.set(cameraSettings.x, cameraSettings.y, cameraSettings.z);
      camera.lookAt(0, cameraSettings.targetY, 0);
      updateOpenPose();
    }

    function initialPaperPosition(i: number) {
      if (i < PAPER_OFFSETS.length) {
        return new THREE.Vector3(PAPER_OFFSETS[i][0], restMeshY, PAPER_OFFSETS[i][2]);
      }
      return randomSpawnPosition();
    }

    function randomSpawnPosition() {
      const margin = collisionRadius * 1.3;
      const pos = new THREE.Vector3(0, restMeshY, 0);
      for (let attempt = 0; attempt < 40; attempt++) {
        pos.x = randomRange(STAGE_BOUNDS.minX + margin, STAGE_BOUNDS.maxX - margin);
        pos.z = randomRange(STAGE_BOUNDS.minZ + margin, STAGE_BOUNDS.maxZ - margin);
        const clear = papers.every((p) => {
          const dx = p.body.position.x - pos.x;
          const dz = p.body.position.z - pos.z;
          return dx * dx + dz * dz > (collisionRadius * 2.4) ** 2;
        });
        if (clear) break;
      }
      return pos;
    }

    let spawnCounter = 0;
    const quoteOffset = Math.floor(Math.random() * LETTER_QUOTES.length);
    function spawnPaper(position: THREE.Vector3, dropIn: boolean, dropHeight = randomRange(0.8, 1.2)) {
      if (!animData) return null;
      const maxFrame = animData.frameCount - 1;
      const quoteIndex = (spawnCounter++ + quoteOffset) % LETTER_QUOTES.length;
      const base = createPaper(animData, quoteIndex);
      base.mesh.castShadow = true;
      base.mesh.rotation.set(
        0,
        Math.PI + randomRange(-0.25, 0.25),
        randomRange(-0.18, 0.18)
      );
      base.mesh.position.copy(position);
      base.mesh.scale.setScalar(CLOSED_SCALE);
      scene.add(base.mesh);
      const body = createPaperBody(base);

      const paper: PaperObject = {
        ...base,
        body,
        frameIdx: maxFrame,
        state: 'closed',
        time: 0,
        homePosition: base.mesh.position.clone(),
        homeRotation: base.mesh.rotation.clone(),
        start: null,
        target: null,
        throw: null,
      };
      updatePaperFrame(paper, animData, maxFrame);
      papers.push(paper);

      if (debugPhysics) {
        const wire = new THREE.Mesh(
          new THREE.SphereGeometry(collisionRadius, 16, 12),
          new THREE.MeshBasicMaterial({ color: 0x00b566, wireframe: true })
        );
        scene.add(wire);
        paper.debugSphere = wire;
      }

      if (dropIn) {
        paper.state = 'rolling';
        paper.throw = { settleTimer: 0 };
        body.position.y += dropHeight;
        body.angularVelocity.set(
          randomRange(-1.5, 1.5),
          randomRange(-0.5, 0.5),
          randomRange(-1.5, 1.5)
        );
        syncMeshToBody(paper);
      }
      return paper;
    }

    function removeOnePaper(): boolean {
      let idx = -1;
      for (let i = papers.length - 1; i >= 0; i--) {
        const p = papers[i];
        if (
          p === activePaper ||
          p.state === 'grabbed' ||
          p.state === 'opening' ||
          p.state === 'open' ||
          p.state === 'discarding'
        ) {
          continue;
        }
        idx = i;
        break;
      }
      if (idx === -1) {
        for (let i = papers.length - 1; i >= 0; i--) {
          if (papers[i].state === 'grabbed') continue;
          idx = i;
          break;
        }
      }
      if (idx === -1) return false;

      const p = papers[idx];
      if (p === activePaper) {
        activePaper = null;
        onCardStateChange?.(null);
      }
      if (pointerState && pointerState.paper === p) pointerState.paper = null;
      if (p.debugSphere) scene.remove(p.debugSphere);
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      physicsWorld.removeBody(p.body);
      papers.splice(idx, 1);
      return true;
    }

    function shakeScene() {
      if (activePaper) {
        activePaper = null;
        onCardStateChange?.(null);
      }
      for (const p of papers) {
        p.state = 'rolling';
        p.throw = { settleTimer: 0 };
        const body = p.body;
        body.type = CANNON.Body.DYNAMIC;
        body.mass = PAPER_MASS;
        body.updateMassProperties();
        body.position.set(
          randomRange(STAGE_BOUNDS.minX * 0.8, STAGE_BOUNDS.maxX * 0.8),
          randomRange(1.2, 2.8),
          randomRange(STAGE_BOUNDS.minZ * 0.7, STAGE_BOUNDS.maxZ * 0.8)
        );
        body.velocity.set(
          randomRange(-4.5, 4.5),
          randomRange(1.0, 3.5),
          randomRange(-4.5, 4.5)
        );
        body.angularVelocity.set(
          randomRange(-8, 8),
          randomRange(-8, 8),
          randomRange(-8, 8)
        );
        body.wakeUp();
      }
    }

    if (sceneRef) {
      sceneRef.current = { shakeScene };
    }

    function syncPaperCount() {
      if (!animData) return;
      const target = Math.round(paperSettings.count);
      while (papers.length > target && removeOnePaper()) {}
      while (papers.length < target) {
        spawnPaper(randomSpawnPosition(), true);
      }
      onPaperCountChange?.(papers.length);
    }

    // --- Pointer Interaction ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const grabPlane = new THREE.Plane();
    const grabHitPoint = new THREE.Vector3();
    let pointerState: {
      paper: PaperObject | null;
      pointerId: number;
      startX: number;
      startY: number;
      grabbing: boolean;
    } | null = null;

    function updatePointer(e: PointerEvent) {
      const curSize = getViewportSize();
      pointer.x = (e.clientX / curSize.w) * 2 - 1;
      pointer.y = -(e.clientY / curSize.h) * 2 + 1;
    }

    function pickPaper(e: PointerEvent): PaperObject | null {
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(papers.map((p) => p.mesh));
      if (hit.length === 0) return null;
      return papers.find((p) => p.mesh === hit[0].object) || null;
    }

    function isGrabbable(paper: PaperObject) {
      return paper.state === 'closed' || paper.state === 'rolling';
    }

    function updateHoverCursor(e: PointerEvent) {
      if (!animData) return;
      const p = pickPaper(e);
      renderer.domElement.style.cursor = p
        ? isGrabbable(p) ? 'grab' : 'pointer'
        : '';
    }

    function beginGrab(paper: PaperObject, e: PointerEvent) {
      if (!pointerState) return;
      pointerState.grabbing = true;
      paper.state = 'grabbed';
      paper.time = 0;

      const body = paper.body;
      body.type = CANNON.Body.KINEMATIC;
      body.mass = 0;
      body.updateMassProperties();
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.collisionFilterGroup = 1;
      body.collisionFilterMask = 1;
      body.wakeUp();

      paper.grab = {
        target: new THREE.Vector3(
          body.position.x,
          restCenterY + GRAB_LIFT,
          body.position.z
        ),
      };
      updateGrabTarget(paper, e);
      renderer.domElement.style.cursor = 'grabbing';
    }

    function updateGrabTarget(paper: PaperObject, e: PointerEvent) {
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      grabPlane.normal.set(0, 1, 0);
      grabPlane.constant = -(restCenterY + GRAB_LIFT);
      if (!raycaster.ray.intersectPlane(grabPlane, grabHitPoint)) return;

      if (!paper.grab) return;
      paper.grab.target.set(
        Math.min(
          Math.max(grabHitPoint.x, STAGE_BOUNDS.minX + collisionRadius),
          STAGE_BOUNDS.maxX - collisionRadius
        ),
        restCenterY + GRAB_LIFT,
        Math.min(
          Math.max(grabHitPoint.z, STAGE_BOUNDS.minZ + collisionRadius),
          STAGE_BOUNDS.maxZ - collisionRadius
        )
      );
    }

    function releaseGrab(paper: PaperObject, withThrow: boolean) {
      const body = paper.body;
      let vx = withThrow ? body.velocity.x : 0;
      let vz = withThrow ? body.velocity.z : 0;
      const speed = Math.hypot(vx, vz);
      if (speed > THROW_MAX_SPEED) {
        const k = THROW_MAX_SPEED / speed;
        vx *= k;
        vz *= k;
      }

      body.type = CANNON.Body.DYNAMIC;
      body.mass = PAPER_MASS;
      body.updateMassProperties();
      body.velocity.set(vx, 0, vz);
      body.angularVelocity.set(
        (vz / collisionRadius) * 0.6,
        0,
        (-vx / collisionRadius) * 0.6
      );
      body.wakeUp();

      paper.state = 'rolling';
      paper.time = 0;
      paper.throw = { settleTimer: 0 };
      renderer.domElement.style.cursor = 'grab';
    }

    function startOpen(paper: PaperObject) {
      setPaperBodyDynamic(paper, false);
      syncMeshToBody(paper);
      paper.state = 'opening';
      paper.time = 0;
      paper.start = captureTransform(paper);
      const pose = computeOpenPose();
      paper.target = {
        position: pose.position,
        quaternion: pose.quaternion,
        scale: pose.scale,
        frameIdx: animSettings.openFrame,
      };

      onCardStateChange?.(paper.quote);
    }

    function startDiscard(paper: PaperObject) {
      if (paper.state === 'discarding' || paper.state === 'rolling') return;

      const dir = new THREE.Vector3(
        randomRange(-1, 1),
        0,
        randomRange(-1.3, -0.45)
      ).normalize();

      paper.state = 'discarding';
      paper.time = 0;
      paper.start = captureTransform(paper);
      setPaperBodyDynamic(paper, true);
      syncBodyToMesh(paper);
      paper.body.velocity.set(
        dir.x * randomRange(1.4, 2.0),
        randomRange(0.5, 0.9),
        dir.z * randomRange(1.4, 2.0)
      );
      paper.body.angularVelocity.set(
        randomRange(-2.4, 2.4),
        randomRange(-0.8, 0.8),
        randomRange(-2.4, 2.4)
      );
      paper.throw = { settleTimer: 0 };

      if (activePaper === paper) {
        activePaper = null;
        onCardStateChange?.(null);
      }
    }

    function handleClick(e: PointerEvent) {
      const p = pickPaper(e);
      if (!p) return;

      const previousActive = activePaper;
      if (previousActive) {
        startDiscard(previousActive);
        activePaper = null;
      }

      if (previousActive === p || p.state !== 'closed') return;

      startOpen(p);
      activePaper = p;
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!animData || pointerState) return;
      const p = pickPaper(e);
      pointerState = {
        paper: p,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        grabbing: false,
      };
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {}

      if (p && p.state === 'rolling') beginGrab(p, e);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerState) {
        updateHoverCursor(e);
        return;
      }
      if (e.pointerId !== pointerState.pointerId) return;

      if (!pointerState.grabbing) {
        const p = pointerState.paper;
        const moved = Math.hypot(
          e.clientX - pointerState.startX,
          e.clientY - pointerState.startY
        );
        if (p && isGrabbable(p) && moved > CLICK_DRAG_THRESHOLD_PX) {
          beginGrab(p, e);
        }
      }
      if (pointerState.grabbing && pointerState.paper) {
        updateGrabTarget(pointerState.paper, e);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerState || e.pointerId !== pointerState.pointerId) return;
      if (pointerState.grabbing && pointerState.paper) {
        releaseGrab(pointerState.paper, true);
      } else {
        handleClick(e);
      }
      pointerState = null;
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (!pointerState || e.pointerId !== pointerState.pointerId) return;
      if (pointerState.grabbing && pointerState.paper) {
        releaseGrab(pointerState.paper, false);
      }
      pointerState = null;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);

    // --- Lil-GUI Setup (全部中文化) ---
    const gui = new GUI({ title: '模拟参数控制面板', autoPlace: false });
    guiInstanceRef.current = gui;
    if (guiContainerRef.current) {
      guiContainerRef.current.innerHTML = '';
      guiContainerRef.current.appendChild(gui.domElement);
    }

    const lightFolder = gui.addFolder('光照设置 (Lighting)');
    lightFolder.add(ambient, 'intensity', 0, 3, 0.01).name('环境光强度');
    lightFolder.add(dirLight, 'intensity', 0, 4, 0.01).name('主光强度');
    lightFolder.add(dirLight.position, 'x', -5, 5, 0.1).name('主光 X轴');
    lightFolder.add(dirLight.position, 'y', 0, 5, 0.1).name('主光 Y轴');
    lightFolder.add(dirLight.position, 'z', -5, 5, 0.1).name('主光 Z轴');
    lightFolder.add(fillLight, 'intensity', 0, 2, 0.01).name('补光强度');

    const ssaoFolder = gui.addFolder('环境光遮蔽 (SSAO)');
    ssaoFolder.add(ssaoPass, 'kernelRadius', 0.001, 0.5, 0.001).name('遮蔽半径');
    ssaoFolder.add(ssaoPass, 'minDistance', 0.0001, 0.01, 0.0001).name('最小距离');
    ssaoFolder.add(ssaoPass, 'maxDistance', 0.01, 0.5, 0.001).name('最大距离');
    ssaoFolder.add(ssaoPass, 'enabled').name('启用 SSAO');

    const colorFolder = gui.addFolder('色彩搭配 (Colors)');
    colorFolder
      .addColor(colorSettings, 'background')
      .name('背景与墙面')
      .onChange((v: string) => {
        scene.background = new THREE.Color(v);
        wallMat.color.set(v);
      });
    colorFolder
      .addColor(colorSettings, 'floor')
      .name('地面质感')
      .onChange((v: string) => {
        floorMat.color.set(v);
      });

    gui.add(animSettings, 'speed', 0.1, 5, 0.1).name('动画速率');
    gui
      .add(animSettings, 'openFrame', 0, 12, 0.5)
      .name('展开褶皱帧')
      .onChange(() => {
        if (activePaper && activePaper.state === 'open' && animData) {
          activePaper.frameIdx = animSettings.openFrame;
          updatePaperFrame(activePaper, animData, activePaper.frameIdx);
        } else if (activePaper && activePaper.target) {
          activePaper.target.frameIdx = animSettings.openFrame;
        }
      });

    gui
      .add(paperSettings, 'count', 1, MAX_PAPERS, 1)
      .name('纸团总数')
      .onFinishChange(syncPaperCount);

    const cameraFolder = gui.addFolder('镜头视角 (Camera)');
    cameraFolder.add(cameraSettings, 'x', -4, 4, 0.05).name('机位 X').onChange(applyCameraSettings);
    cameraFolder.add(cameraSettings, 'y', 0.2, 4, 0.05).name('机位 Y').onChange(applyCameraSettings);
    cameraFolder.add(cameraSettings, 'z', 0.8, 7, 0.05).name('机位 Z').onChange(applyCameraSettings);
    cameraFolder.add(cameraSettings, 'targetY', 0, 2, 0.05).name('注视点高度').onChange(applyCameraSettings);
    cameraFolder.add(camera, 'fov', 10, 90, 1).name('视场角 (FOV)').onChange(() => {
      camera.updateProjectionMatrix();
      updateOpenPose();
    });

    // --- Animation & Motion ---
    function updatePaperMotion(paper: PaperObject, dt: number) {
      if (!animData) return;
      const maxFrame = animData.frameCount - 1;

      if (paper.state === 'opening') {
        paper.time += dt * animSettings.speed;
        const t = clamp01(paper.time / OPEN_DURATION);
        const e = easeOutCubic(t);
        const openEase = easeInCubic(t);

        paper.mesh.position.lerpVectors(
          paper.start.position,
          paper.target.position,
          e
        );
        paper.mesh.quaternion.slerpQuaternions(
          paper.start.quaternion,
          paper.target.quaternion,
          e
        );
        paper.mesh.scale.setScalar(lerp(paper.start.scale, paper.target.scale, e));

        paper.frameIdx = lerp(
          paper.start.frameIdx,
          paper.target.frameIdx,
          openEase
        );
        updatePaperFrame(paper, animData, paper.frameIdx);

        if (t >= 1) {
          paper.state = 'open';
          paper.frameIdx = paper.target.frameIdx;
          paper.mesh.position.copy(paper.target.position);
          paper.mesh.quaternion.copy(paper.target.quaternion);
          paper.mesh.scale.setScalar(paper.target.scale);
          syncBodyToMesh(paper);
          updatePaperFrame(paper, animData, paper.frameIdx);
        }
        return;
      }

      if (paper.state === 'discarding') {
        paper.time += dt * animSettings.speed;
        const t = clamp01(paper.time / DISCARD_DURATION);
        const closeEase = easeOutCubic(t);
        const scale = lerp(paper.start.scale, CLOSED_SCALE, closeEase);

        paper.frameIdx = lerp(paper.start.frameIdx, maxFrame, closeEase);
        syncMeshToBody(paper, scale);
        updatePaperFrame(paper, animData, paper.frameIdx);

        if (t >= 1) {
          paper.state = 'rolling';
          paper.time = 0;
          paper.frameIdx = maxFrame;
          updatePaperFrame(paper, animData, paper.frameIdx);
        }
        return;
      }

      if (paper.state === 'grabbed') {
        if (!paper.grab) return;
        const body = paper.body;
        const target = paper.grab.target;
        let vx = (target.x - body.position.x) * GRAB_STIFFNESS;
        let vy = (target.y - body.position.y) * GRAB_STIFFNESS;
        let vz = (target.z - body.position.z) * GRAB_STIFFNESS;
        const speed = Math.hypot(vx, vy, vz);
        if (speed > GRAB_MAX_SPEED) {
          const k = GRAB_MAX_SPEED / speed;
          vx *= k;
          vy *= k;
          vz *= k;
        }
        body.velocity.set(vx, vy, vz);
        syncMeshToBody(paper);
        return;
      }

      if (paper.state === 'rolling') {
        paper.time += dt;
        const grounded = isOnGround(paper.body);
        if (grounded) applyRollingResistance(paper.body, dt);
        syncMeshToBody(paper);
        const speed =
          paper.body.velocity.lengthSquared() +
          paper.body.angularVelocity.lengthSquared() * 0.02;
        if (paper.throw) {
          paper.throw.settleTimer = grounded && speed < ROLL_SETTLE_SPEED
            ? paper.throw.settleTimer + dt
            : 0;

          if (paper.throw.settleTimer > 0.35) {
            finishRollingPaper(paper, maxFrame);
          }
        }
        return;
      }

      if (paper.state === 'closed') {
        if (isOnGround(paper.body)) applyRollingResistance(paper.body, dt);
        syncMeshToBody(paper);
      }
    }

    let prevTime = performance.now() / 1000;
    let animHandle: number;

    function tick() {
      if (isDisposed) return;
      const now = performance.now() / 1000;
      const dt = Math.min(now - prevTime, 0.1);
      prevTime = now;

      if (animData) {
        physicsWorld.step(PHYSICS_STEP, Math.min(dt, 0.05), 3);
        applyPhysicsBounds(dt);

        for (const p of papers) {
          updatePaperMotion(p, dt);
        }

        if (debugPhysics) {
          for (const p of papers) {
            if (!p.debugSphere) continue;
            p.debugSphere.position.set(
              p.body.position.x,
              p.body.position.y,
              p.body.position.z
            );
          }
        }
      }

      composer.render();
      animHandle = requestAnimationFrame(tick);
    }

    animHandle = requestAnimationFrame(tick);

    // Resize Handler
    const onResize = () => {
      const curSize = getViewportSize();
      camera.aspect = curSize.w / curSize.h;
      camera.updateProjectionMatrix();
      renderer.setSize(curSize.w, curSize.h);
      composer.setSize(curSize.w, curSize.h);
      updateStageBounds();
      updateOpenPose();
    };
    window.addEventListener('resize', onResize);

    // VAT Data Load with fallbacks and explicit progress
    loadVATData('/vat/', {
      onProgress: (p, stage) => {
        onProgress?.(p, stage);
      },
    })
      .then((data) => {
        if (isDisposed) return;
        animData = data;
        flatSize.width = data.flat.width;
        flatSize.depth = data.flat.depth;

        crumpleCenter.fromArray(data.crumple.center);
        collisionRadius = data.crumple.radius * CLOSED_SCALE;
        restCenterY = FLOOR_VISUAL_Y + collisionRadius * 1.08;
        restMeshY = restCenterY - crumpleCenter.y * CLOSED_SCALE;
        floorBody.position.y = restCenterY - collisionRadius;

        if (debugFrame !== null) {
          for (let i = 0; i < paperSettings.count; i++) {
            const position =
              paperSettings.count === 1
                ? new THREE.Vector3(0, restMeshY, 0.2)
                : initialPaperPosition(i);
            const paper = spawnPaper(position, false);
            if (!paper) continue;
            setPaperBodyDynamic(paper, false);
            paper.state = 'posed';
            paper.frameIdx = Math.max(0, Math.min(debugFrame, data.frameCount - 1));
            updatePaperFrame(paper, data, paper.frameIdx);
          }
        } else {
          for (let i = 0; i < paperSettings.count; i++) {
            const delay = i * 45 + randomRange(0, 90);
            setTimeout(() => {
              if (isDisposed) return;
              spawnPaper(initialPaperPosition(i), true, randomRange(4.2, 8.2));
            }, delay);
          }
        }

        onLoaded?.();
      })
      .catch((err) => {
        console.error('加载 VAT 资源失败:', err);
        onError?.(err);
      });

    // Cleanup on component unmount
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animHandle);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);

      try {
        gui.destroy();
      } catch {}

      try {
        renderer.dispose();
      } catch {}

      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-default" />
      <div
        className={`absolute top-14 sm:top-16 right-3 sm:right-4 z-40 max-w-[calc(100vw-1.5rem)] sm:max-w-xs flex flex-col items-end gap-1.5 transition-all duration-200 ${
          guiVisible
            ? 'opacity-100 pointer-events-auto translate-y-0'
            : 'opacity-0 pointer-events-none -translate-y-2'
        }`}
      >
        <button
          onClick={onToggleGui}
          className="px-3 py-1 text-xs font-sans font-medium text-white/95 bg-black/65 hover:bg-black/85 rounded-full backdrop-blur-md border border-white/25 shadow-md cursor-pointer flex items-center gap-1 transition-colors"
          title="关闭调光参数面板"
        >
          <span>✕ 关闭面板</span>
        </button>

        <div
          ref={guiContainerRef}
          className="max-h-[72vh] overflow-y-auto rounded-2xl shadow-2xl border border-white/25"
        />
      </div>
    </div>
  );
};
