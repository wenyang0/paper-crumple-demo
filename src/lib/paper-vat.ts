import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const FRAME_COUNT = 50;

export interface VATAnimData {
  vertexCount: number;
  frameCount: number;
  indices: number[];
  uvs: number[];
  positions: Float32Array;
  normals: Float32Array;
  crumple: {
    center: [number, number, number];
    radius: number;
  };
  flat: {
    width: number;
    depth: number;
  };
}

export interface VATLoadOptions {
  decodeMode?: 'correct' | 'naive' | 'reversed' | 'noflip' | 'nomirror';
  normalsMode?: 'smooth' | 'flat';
  onProgress?: (progress: number, stage: string) => void;
}

/**
 * 尝试从多个候选 URL 依次请求 ArrayBuffer
 */
async function fetchArrayBufferWithFallback(
  candidateUrls: string[],
  fileDescription: string
): Promise<{ buffer: ArrayBuffer; url: string }> {
  const errors: string[] = [];

  for (const url of candidateUrls) {
    try {
      console.log(`[VAT] 尝试下载 ${fileDescription}: ${url}`);
      const res = await fetch(url);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        if (buffer && buffer.byteLength > 0) {
          console.log(`[VAT] 成功获取 ${fileDescription} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB) 来自: ${url}`);
          return { buffer, url };
        }
      }
      errors.push(`${url} 返回 HTTP ${res.status}`);
    } catch (err: any) {
      errors.push(`${url} 失败: ${err.message}`);
    }
  }

  throw new Error(`无法获取 ${fileDescription} 数据。已尝试的路径:\n${errors.join('\n')}`);
}

/**
 * 加载并解析 VAT 顶点动画数据 (FBX 模型 + EXR 烘焙位置贴图)
 */
export async function loadVATData(
  basePath = '/vat/',
  options: VATLoadOptions = {}
): Promise<VATAnimData> {
  const DECODE_MODE = options.decodeMode || 'correct';
  const NORMALS_MODE = options.normalsMode || 'smooth';

  options.onProgress?.(10, '正在连接模型与纹理资源...');

  // 构建健壮的候选路径列表 (优先相对当前页面，次优根目录与 Vite public 路径)
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentDir = typeof window !== 'undefined' ? window.location.pathname.replace(/[^/]*$/, '') : '/';

  const fbxCandidates = [
    `https://cdn.jsdmirror.com/gh/wenyang0/paper-crumple-demo@main/public/vat/geo/vertex_animation_textures1_mesh.fbx`,
    `https://cdn.jsdelivr.net/gh/wenyang0/paper-crumple-demo@main/public/vat/geo/vertex_animation_textures1_mesh.fbx`,
    `${basePath}geo/vertex_animation_textures1_mesh.fbx`,
    `/vat/geo/vertex_animation_textures1_mesh.fbx`,
    `./vat/geo/vertex_animation_textures1_mesh.fbx`,
    `${origin}${currentDir}vat/geo/vertex_animation_textures1_mesh.fbx`.replace(/([^:]\/)\/+/g, '$1'),
  ];

  const exrCandidates = [
    `https://cdn.jsdmirror.com/gh/wenyang0/paper-crumple-demo@main/public/vat/tex/vertex_animation_textures1_pos.exr`,
    `https://cdn.jsdelivr.net/gh/wenyang0/paper-crumple-demo@main/public/vat/tex/vertex_animation_textures1_pos.exr`,
    `${basePath}tex/vertex_animation_textures1_pos.exr`,
    `/vat/tex/vertex_animation_textures1_pos.exr`,
    `./vat/tex/vertex_animation_textures1_pos.exr`,
    `${origin}${currentDir}vat/tex/vertex_animation_textures1_pos.exr`.replace(/([^:]\/)\/+/g, '$1'),
  ];

  options.onProgress?.(25, '正在下载 FBX 网格与 EXR 位置贴图...');

  const [fbxResult, exrResult] = await Promise.all([
    fetchArrayBufferWithFallback(fbxCandidates, 'FBX 网格文件'),
    fetchArrayBufferWithFallback(exrCandidates, 'EXR 位置贴图文件'),
  ]);

  options.onProgress?.(55, '正在解析 FBX 顶点拓扑结构...');

  const fbxLoader = new FBXLoader();
  const fbxGroup = fbxLoader.parse(fbxResult.buffer, '');

  let fbxMesh: THREE.Mesh | null = null;
  fbxGroup.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !fbxMesh) {
      fbxMesh = child as THREE.Mesh;
    }
  });

  if (!fbxMesh) {
    throw new Error('FBX 模型中未找到可渲染网格 (Mesh)');
  }

  const geo = (fbxMesh as THREE.Mesh).geometry;
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const indexAttr = geo.getIndex();
  const vertexCount = posAttr.count;

  const vatUvAttr = (geo.getAttribute('uv2') || geo.getAttribute('uv1')) as THREE.BufferAttribute | undefined;

  const indices: number[] = [];
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i++) indices.push(indexAttr.getX(i));
  } else {
    for (let i = 0; i < vertexCount; i += 3) {
      const hasInvalidVatUv =
        vatUvAttr &&
        (
          (vatUvAttr.getX(i) === 0 && vatUvAttr.getY(i) === 0) ||
          (vatUvAttr.getX(i + 1) === 0 && vatUvAttr.getY(i + 1) === 0) ||
          (vatUvAttr.getX(i + 2) === 0 && vatUvAttr.getY(i + 2) === 0)
        );
      if (hasInvalidVatUv) continue;

      indices.push(i, i + 1, i + 2);
    }
  }

  const uvs: number[] = [];
  if (uvAttr) {
    for (let i = 0; i < uvAttr.count; i++) {
      uvs.push(uvAttr.getX(i), uvAttr.getY(i));
    }
  }

  options.onProgress?.(70, '正在解码 32位 EXR 浮点位移序列...');

  const exrLoader = new EXRLoader();
  exrLoader.setDataType(THREE.FloatType);
  const parsedExr = exrLoader.parse(exrResult.buffer);

  const texW = parsedExr.width;
  const texH = parsedExr.height;
  const posData = parsedExr.data as Float32Array;
  const channels = posData.length / (texW * texH);

  const rawFrameCount = FRAME_COUNT;
  let pointCount = vertexCount;

  if (vatUvAttr) {
    pointCount = 0;
    for (let v = 0; v < vertexCount; v++) {
      if (vatUvAttr.getX(v) === 0 && vatUvAttr.getY(v) === 0) continue;

      const col = Math.floor(vatUvAttr.getX(v) * texW);
      const row = Math.floor((1 - vatUvAttr.getY(v)) * texH);
      pointCount = Math.max(pointCount, row * texW + col + 1);
    }
  }

  const rowsPerFrame = Math.ceil(pointCount / texW);

  const vertexPointIds = new Int32Array(vertexCount);
  for (let v = 0; v < vertexCount; v++) {
    let pointId: number;
    if (vatUvAttr) {
      if (vatUvAttr.getX(v) === 0 && vatUvAttr.getY(v) === 0) {
        pointId = 0;
      } else {
        const col = Math.floor(vatUvAttr.getX(v) * texW);
        const row = Math.floor((1 - vatUvAttr.getY(v)) * texH);
        pointId = row * texW + col;
      }
    } else {
      pointId = v;
    }
    vertexPointIds[v] = Math.max(0, Math.min(pointId, pointCount - 1));
  }

  const rawPositions = new Float32Array(vertexCount * 3 * rawFrameCount);
  const totalRows = rawFrameCount * rowsPerFrame;

  for (let frame = 0; frame < rawFrameCount; frame++) {
    for (let v = 0; v < vertexCount; v++) {
      const pointId = vertexPointIds[v];

      const col = pointId % texW;
      const blockRow = Math.floor(pointId / texW);
      let row: number;
      if (DECODE_MODE === 'naive') {
        row = frame * rowsPerFrame + blockRow;
      } else if (DECODE_MODE === 'reversed') {
        row = frame * rowsPerFrame + (rowsPerFrame - 1 - blockRow);
      } else if (DECODE_MODE === 'noflip') {
        row = (rawFrameCount - 1 - frame) * rowsPerFrame + blockRow;
      } else {
        row = totalRows - 1 - (frame * rowsPerFrame + blockRow);
      }
      const pixelIdx = (row * texW + col) * channels;
      const off = (frame * vertexCount + v) * 3;

      const xSign = DECODE_MODE === 'nomirror' ? 1 : -1;
      rawPositions[off + 0] = posAttr.getX(v) + xSign * posData[pixelIdx + 0];
      rawPositions[off + 1] = posAttr.getY(v) + posData[pixelIdx + 1];
      rawPositions[off + 2] = posAttr.getZ(v) + posData[pixelIdx + 2];
    }
  }

  const frameStride = vertexCount * 3;
  const frameDeltas: number[] = [];
  for (let frame = 0; frame < rawFrameCount - 1; frame++) {
    const a = frame * frameStride;
    const b = (frame + 1) * frameStride;
    let maxDelta = 0;
    for (let i = 0; i < frameStride; i++) {
      const d = Math.abs(rawPositions[a + i] - rawPositions[b + i]);
      if (d > maxDelta) maxDelta = d;
    }
    frameDeltas.push(maxDelta);
  }

  const MOTION_EPSILON = 1e-4;
  let firstMoving = frameDeltas.findIndex((d) => d > MOTION_EPSILON);
  let lastMoving = frameDeltas.length - 1;
  while (lastMoving >= 0 && frameDeltas[lastMoving] <= MOTION_EPSILON) {
    lastMoving--;
  }

  let frameCount = rawFrameCount;
  let positions = rawPositions;
  if (
    DECODE_MODE === 'correct' &&
    (firstMoving > 0 || lastMoving < frameDeltas.length - 1)
  ) {
    if (firstMoving === -1) firstMoving = 0;
    frameCount = lastMoving + 2 - firstMoving;
    positions = rawPositions.slice(
      firstMoving * frameStride,
      (firstMoving + frameCount) * frameStride,
    );
  }

  const validVerts: number[] = [];
  for (let v = 0; v < vertexCount; v++) {
    if (vatUvAttr && vatUvAttr.getX(v) === 0 && vatUvAttr.getY(v) === 0) continue;
    validVerts.push(v);
  }

  let minFX = Infinity;
  let maxFX = -Infinity;
  let minFZ = Infinity;
  let maxFZ = -Infinity;
  for (const v of validVerts) {
    const x = positions[v * 3 + 0];
    const z = positions[v * 3 + 2];
    if (x < minFX) minFX = x;
    if (x > maxFX) maxFX = x;
    if (z < minFZ) minFZ = z;
    if (z > maxFZ) maxFZ = z;
  }
  const flat = { width: maxFX - minFX, depth: maxFZ - minFZ };

  const lastOff = (frameCount - 1) * frameStride;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const v of validVerts) {
    cx += positions[lastOff + v * 3 + 0];
    cy += positions[lastOff + v * 3 + 1];
    cz += positions[lastOff + v * 3 + 2];
  }
  cx /= validVerts.length;
  cy /= validVerts.length;
  cz /= validVerts.length;

  const dists = new Float32Array(validVerts.length);
  for (let i = 0; i < validVerts.length; i++) {
    const v = validVerts[i];
    const dx = positions[lastOff + v * 3 + 0] - cx;
    const dy = positions[lastOff + v * 3 + 1] - cy;
    const dz = positions[lastOff + v * 3 + 2] - cz;
    dists[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  dists.sort();
  const crumple = {
    center: [cx, cy, cz] as [number, number, number],
    radius: dists[Math.floor(validVerts.length * 0.9)],
  };

  options.onProgress?.(85, '正在平滑法线与构建拓扑光影...');

  const normals = new Float32Array(vertexCount * 3 * frameCount);
  const pointNormals = new Float32Array(pointCount * 3);

  for (let frame = 0; frame < frameCount; frame++) {
    const srcOff = frame * vertexCount * 3;

    if (NORMALS_MODE === 'flat') {
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3;
        const b = indices[i + 1] * 3;
        const c = indices[i + 2] * 3;
        const ax = positions[srcOff + a];
        const ay = positions[srcOff + a + 1];
        const az = positions[srcOff + a + 2];
        const e1x = positions[srcOff + b] - ax;
        const e1y = positions[srcOff + b + 1] - ay;
        const e1z = positions[srcOff + b + 2] - az;
        const e2x = positions[srcOff + c] - ax;
        const e2y = positions[srcOff + c + 1] - ay;
        const e2z = positions[srcOff + c + 2] - az;
        let nx = e1y * e2z - e1z * e2y;
        let ny = e1z * e2x - e1x * e2z;
        let nz = e1x * e2y - e1y * e2x;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        for (let k = 0; k < 3; k++) {
          const o = srcOff + indices[i + k] * 3;
          normals[o] = nx;
          normals[o + 1] = ny;
          normals[o + 2] = nz;
        }
      }
      continue;
    }

    pointNormals.fill(0);

    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3;
      const b = indices[i + 1] * 3;
      const c = indices[i + 2] * 3;

      const ax = positions[srcOff + a];
      const ay = positions[srcOff + a + 1];
      const az = positions[srcOff + a + 2];
      const e1x = positions[srcOff + b] - ax;
      const e1y = positions[srcOff + b + 1] - ay;
      const e1z = positions[srcOff + b + 2] - az;
      const e2x = positions[srcOff + c] - ax;
      const e2y = positions[srcOff + c + 1] - ay;
      const e2z = positions[srcOff + c + 2] - az;

      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;

      for (let k = 0; k < 3; k++) {
        const pid = vertexPointIds[indices[i + k]] * 3;
        pointNormals[pid] += nx;
        pointNormals[pid + 1] += ny;
        pointNormals[pid + 2] += nz;
      }
    }

    for (let p = 0; p < pointCount; p++) {
      const o = p * 3;
      const len = Math.hypot(
        pointNormals[o],
        pointNormals[o + 1],
        pointNormals[o + 2],
      );
      if (len > 1e-10) {
        pointNormals[o] /= len;
        pointNormals[o + 1] /= len;
        pointNormals[o + 2] /= len;
      } else {
        pointNormals[o] = 0;
        pointNormals[o + 1] = 1;
        pointNormals[o + 2] = 0;
      }
    }

    for (let v = 0; v < vertexCount; v++) {
      const pid = vertexPointIds[v] * 3;
      const o = srcOff + v * 3;
      normals[o] = pointNormals[pid];
      normals[o + 1] = pointNormals[pid + 1];
      normals[o + 2] = pointNormals[pid + 2];
    }
  }

  options.onProgress?.(100, '准备完成！');
  return { vertexCount, frameCount, indices, uvs, positions, normals, crumple, flat };
}
