import * as THREE from 'three';
import { getLetterQuotes, LoveLetterQuote } from '../data/quotes';

export const LETTER_QUOTES: LoveLetterQuote[] = getLetterQuotes();

const TEX_W = 1024;
const TEX_H = 1400;

const HAND_FONT = '"Ma Shan Zheng", "ZCOOL KuaiLe", "Caveat", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Serif SC", serif';

export interface PaperColorTheme {
  name: string;
  paperBg: string;
  paperAccent: string;
  border: string;
  innerBorder: string;
  gridLine: string;
  inkTitle: string;
  inkBody: string;
  inkSignature: string;
  sealColor: string;
  sealText: string;
  stampBg: string;
}

export const PAPER_THEMES: PaperColorTheme[] = [
  {
    name: "樱粉笺", // 浪漫樱花粉
    paperBg: "#fff0f3",
    paperAccent: "#ffe1e7",
    border: "rgba(225, 130, 155, 0.6)",
    innerBorder: "rgba(225, 130, 155, 0.32)",
    gridLine: "rgba(220, 140, 165, 0.25)",
    inkTitle: "#702438",
    inkBody: "#3a1520",
    inkSignature: "#702438",
    sealColor: "rgba(215, 45, 80, 0.9)",
    sealText: "欢喜",
    stampBg: "#fce0e6",
  },
  {
    name: "天青笺", // 清透天青蓝
    paperBg: "#edf8fa",
    paperAccent: "#d8f0f5",
    border: "rgba(85, 165, 185, 0.6)",
    innerBorder: "rgba(85, 165, 185, 0.32)",
    gridLine: "rgba(95, 175, 195, 0.25)",
    inkTitle: "#164e63",
    inkBody: "#112e38",
    inkSignature: "#164e63",
    sealColor: "rgba(18, 120, 150, 0.9)",
    sealText: "心安",
    stampBg: "#d3edf3",
  },
  {
    name: "缃黄笺", // 暖阳杏黄麦浪
    paperBg: "#fff9ea",
    paperAccent: "#ffefcc",
    border: "rgba(215, 160, 80, 0.6)",
    innerBorder: "rgba(215, 160, 80, 0.32)",
    gridLine: "rgba(200, 150, 85, 0.25)",
    inkTitle: "#78350f",
    inkBody: "#361d0a",
    inkSignature: "#78350f",
    sealColor: "rgba(195, 55, 30, 0.9)",
    sealText: "珍藏",
    stampBg: "#fbe8c3",
  },
  {
    name: "丁香笺", // 梦幻丁香紫
    paperBg: "#f7f1fc",
    paperAccent: "#ecddf9",
    border: "rgba(160, 125, 215, 0.6)",
    innerBorder: "rgba(160, 125, 215, 0.32)",
    gridLine: "rgba(160, 125, 210, 0.25)",
    inkTitle: "#4c1d95",
    inkBody: "#251240",
    inkSignature: "#4c1d95",
    sealColor: "rgba(135, 60, 185, 0.9)",
    sealText: "深情",
    stampBg: "#ebd7fb",
  },
  {
    name: "竹青笺", // 清新嫩绿春竹
    paperBg: "#f0f8f1",
    paperAccent: "#dbf0df",
    border: "rgba(110, 175, 120, 0.6)",
    innerBorder: "rgba(110, 175, 120, 0.32)",
    gridLine: "rgba(115, 175, 125, 0.25)",
    inkTitle: "#14532d",
    inkBody: "#122a18",
    inkSignature: "#14532d",
    sealColor: "rgba(35, 130, 70, 0.9)",
    sealText: "如意",
    stampBg: "#d8f2dc",
  },
  {
    name: "暮霞笺", // 温润落日暮橙
    paperBg: "#fff3ec",
    paperAccent: "#ffe2d3",
    border: "rgba(235, 140, 110, 0.6)",
    innerBorder: "rgba(235, 140, 110, 0.32)",
    gridLine: "rgba(225, 140, 110, 0.25)",
    inkTitle: "#831843",
    inkBody: "#381521",
    inkSignature: "#831843",
    sealColor: "rgba(205, 50, 55, 0.9)",
    sealText: "向暖",
    stampBg: "#fde1d1",
  },
  {
    name: "月白笺", // 经典素雅月白
    paperBg: "#fdfbf7",
    paperAccent: "#f3eee3",
    border: "rgba(165, 135, 105, 0.55)",
    innerBorder: "rgba(165, 135, 105, 0.3)",
    gridLine: "rgba(160, 140, 120, 0.22)",
    inkTitle: "#443425",
    inkBody: "#211c18",
    inkSignature: "#443425",
    sealColor: "rgba(185, 43, 39, 0.9)",
    sealText: "自得",
    stampBg: "#ebe3d2",
  },
];

interface LetterState {
  quote: LoveLetterQuote;
  theme: PaperColorTheme;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshStandardMaterial;
}

const letterStates: Map<number, LetterState> = new Map();

/**
 * 绘制信笺右上角的古典印鉴
 */
function drawRedSeal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.04);

  // 印章外框
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.strokeRect(-28, -28, 56, 56);

  // 印章内细框
  ctx.strokeStyle = color.replace(/[\d\.]+\)$/, '0.45)');
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-24, -24, 48, 48);

  // 印文
  ctx.fillStyle = color;
  ctx.font = 'bold 22px "Ma Shan Zheng", "PingFang SC", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 1);

  ctx.restore();
}

/**
 * 绘制复古邮票与水墨戳记
 */
function drawPostStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  theme: PaperColorTheme
) {
  ctx.save();
  ctx.translate(x, y);

  // 齿孔邮票底色
  ctx.fillStyle = theme.stampBg;
  ctx.fillRect(-45, -35, 90, 70);

  // 邮票边框
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-43, -33, 86, 66);

  // 邮票图案（小飞鸟与爱心）
  ctx.fillStyle = theme.inkTitle;
  ctx.font = '28px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("🕊️", 0, -5);

  ctx.font = 'bold 10px font-mono';
  ctx.fillStyle = theme.inkTitle;
  ctx.fillText("LOVE LETTER", 0, 20);

  // 邮戳波浪印
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(30, 20, 28, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(10, 15);
  ctx.lineTo(50, 15);
  ctx.moveTo(10, 22);
  ctx.lineTo(50, 22);
  ctx.stroke();

  ctx.restore();
}

/**
 * 将整段金句按信笺宽度智能折行
 */
function wrapQuoteText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const testLine = currentLine + char;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * 绘制高品质彩色情书信笺纹理
 */
function drawLoveLetter(
  ctx: CanvasRenderingContext2D,
  quote: LoveLetterQuote,
  theme: PaperColorTheme
) {
  // 1. 采用主题渐变纸张底色
  const bgGrad = ctx.createLinearGradient(0, 0, TEX_W, TEX_H);
  bgGrad.addColorStop(0, theme.paperBg);
  bgGrad.addColorStop(1, theme.paperAccent);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // 2. 复古双层信纸装饰边框
  const margin = 50;
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(margin, margin, TEX_W - margin * 2, TEX_H - margin * 2);

  ctx.strokeStyle = theme.innerBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(margin + 8, margin + 8, TEX_W - margin * 2 - 16, TEX_H - margin * 2 - 16);

  // 四角典雅菱形装饰点
  const corners = [
    [margin + 8, margin + 8],
    [TEX_W - margin - 8, margin + 8],
    [margin + 8, TEX_H - margin - 8],
    [TEX_W - margin - 8, TEX_H - margin - 8],
  ];
  ctx.fillStyle = theme.border;
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. 信笺横格纹线
  const lineStartY = 280;
  const lineSpacing = 74;
  const lineEndY = 1180;
  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = 1.2;
  for (let y = lineStartY; y <= lineEndY; y += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(margin + 36, y);
    ctx.lineTo(TEX_W - margin - 36, y);
    ctx.stroke();
  }

  // 4. 右上角邮戳与彩色邮票
  drawPostStamp(ctx, TEX_W - margin - 100, margin + 85, theme);

  // 5. 左上角信笺抬头 (Salutation)
  ctx.fillStyle = theme.inkTitle;
  ctx.font = `bold 52px ${HAND_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`「${quote.salutation}」`, margin + 45, margin + 85);

  // 抬头下方精致小副标
  ctx.fillStyle = theme.inkTitle;
  ctx.globalAlpha = 0.65;
  ctx.font = `22px "PingFang SC", serif`;
  ctx.fillText(`—— 打开时光揉皱的心事 · ${theme.name}`, margin + 50, margin + 138);
  ctx.globalAlpha = 1.0;

  // 6. 核心正文 (金句排版优化)
  const content = quote.content;
  const maxContentW = TEX_W - margin * 2 - 130;

  let fontSize = 54;
  let lineHeight = 86;
  if (content.length > 55) {
    fontSize = 44;
    lineHeight = 72;
  } else if (content.length < 25) {
    fontSize = 62;
    lineHeight = 98;
  }

  ctx.font = `${fontSize}px ${HAND_FONT}`;
  const lines = wrapQuoteText(ctx, content, maxContentW);

  const totalTextHeight = lines.length * lineHeight;
  const contentCenterY = 700;
  let textStartY = Math.max(340, contentCenterY - totalTextHeight / 2 + lineHeight * 0.7);

  // 绘制开篇大引文
  ctx.fillStyle = theme.border;
  ctx.globalAlpha = 0.35;
  ctx.font = `bold 120px serif`;
  ctx.fillText("“", margin + 30, textStartY - 20);
  ctx.globalAlpha = 1.0;

  // 绘制每行正文
  ctx.fillStyle = theme.inkBody;
  ctx.font = `${fontSize}px ${HAND_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = i === 0 ? 50 : 0;
    ctx.fillText(line, margin + 65 + indent, textStartY + i * lineHeight);
  }

  // 结尾引文
  const lastLineY = textStartY + (lines.length - 1) * lineHeight;
  ctx.fillStyle = theme.border;
  ctx.globalAlpha = 0.35;
  ctx.font = `bold 100px serif`;
  const lastLineWidth = ctx.measureText(lines[lines.length - 1]).width + (lines.length === 1 ? 50 : 0);
  ctx.fillText("”", Math.min(margin + 80 + lastLineWidth, TEX_W - margin - 80), lastLineY + 25);
  ctx.globalAlpha = 1.0;

  // 7. 信笺落款
  ctx.fillStyle = theme.inkSignature;
  ctx.font = `36px ${HAND_FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(quote.signature, TEX_W - margin - 140, 1230);

  // 8. 主题印章
  drawRedSeal(ctx, TEX_W - margin - 75, 1215, theme.sealText, theme.sealColor);

  // 9. 信纸底栏编号水印
  ctx.fillStyle = theme.border;
  ctx.globalAlpha = 0.7;
  ctx.font = '16px font-mono';
  ctx.textAlign = "center";
  ctx.fillText(`LETTER NO. ${String(quote.id).padStart(3, '0')} / 100 · ${theme.name}`, TEX_W / 2, TEX_H - margin - 15);
  ctx.globalAlpha = 1.0;
}

if (typeof document !== 'undefined' && document.fonts) {
  Promise.all([
    document.fonts.load('100px "Ma Shan Zheng"'),
    document.fonts.load('100px "ZCOOL KuaiLe"'),
    document.fonts.load('100px "Caveat"'),
  ]).then(() => {
    for (const [, state] of letterStates) {
      drawLoveLetter(state.ctx, state.quote, state.theme);
      state.texture.needsUpdate = true;
    }
  }).catch(() => {});
}

/**
 * 根据索引获取对应彩色情书材质
 */
export function getLetterMaterial(index: number): THREE.MeshStandardMaterial {
  const quoteIndex = index % LETTER_QUOTES.length;
  const quote = LETTER_QUOTES[quoteIndex];
  const theme = PAPER_THEMES[quote.id % PAPER_THEMES.length];

  if (letterStates.has(quote.id)) {
    return letterStates.get(quote.id)!.material;
  }

  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d")!;
  drawLoveLetter(ctx, quote, theme);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.rotation = Math.PI;
  texture.center.set(0.5, 0.5);
  texture.repeat.set(1, -1);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  letterStates.set(quote.id, {
    quote,
    theme,
    canvas,
    ctx,
    texture,
    material,
  });

  return material;
}

export interface PaperMeshBundle {
  mesh: THREE.Mesh;
  positionAttr: THREE.BufferAttribute;
  normalAttr: THREE.BufferAttribute;
  quote: LoveLetterQuote;
  theme: PaperColorTheme;
}

export function createPaper(animData: any, designIndex = 0): PaperMeshBundle {
  const { vertexCount, indices, uvs, positions, normals } = animData;
  const quote = LETTER_QUOTES[designIndex % LETTER_QUOTES.length];
  const theme = PAPER_THEMES[quote.id % PAPER_THEMES.length];

  const geometry = new THREE.BufferGeometry();

  const positionArray = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount * 3; i++) {
    positionArray[i] = positions[i];
  }
  const positionAttr = new THREE.BufferAttribute(positionArray, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttr);

  const normalArray = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount * 3; i++) {
    normalArray[i] = normals[i];
  }
  const normalAttr = new THREE.BufferAttribute(normalArray, 3);
  normalAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("normal", normalAttr);

  const uvArray = new Float32Array(uvs.length);
  for (let i = 0; i < uvs.length; i++) {
    uvArray[i] = uvs[i];
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvArray, 2));

  const indexArray = new Uint16Array(indices);
  geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));

  const mesh = new THREE.Mesh(geometry, getLetterMaterial(designIndex));

  return {
    mesh,
    positionAttr,
    normalAttr,
    quote,
    theme,
  };
}

export function updatePaperFrame(
  paper: { mesh: THREE.Mesh; positionAttr: THREE.BufferAttribute; normalAttr: THREE.BufferAttribute },
  animData: any,
  frameIdx: number
) {
  const { vertexCount, frameCount, positions, normals } = animData;
  const { positionAttr, normalAttr } = paper;

  const len = vertexCount * 3;
  const f0 = Math.floor(frameIdx);
  const t = frameIdx - f0;

  const off0 = f0 * len;

  const posArray = positionAttr.array as Float32Array;
  const nrmArray = normalAttr.array as Float32Array;

  if (t < 1e-6) {
    for (let i = 0; i < len; i++) {
      posArray[i] = positions[off0 + i];
      nrmArray[i] = normals[off0 + i];
    }
  } else {
    const f1 = (f0 + 1) % frameCount;
    const off1 = f1 * len;
    const s = 1 - t;
    for (let i = 0; i < len; i++) {
      posArray[i] = positions[off0 + i] * s + positions[off1 + i] * t;
      nrmArray[i] = normals[off0 + i] * s + normals[off1 + i] * t;
    }
  }

  positionAttr.needsUpdate = true;
  normalAttr.needsUpdate = true;

  paper.mesh.geometry.computeBoundingSphere();
  paper.mesh.geometry.computeBoundingBox();
}
