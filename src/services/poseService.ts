// =============================================================================
// poseService — MediaPipe Pose Landmarker wrapper (client-side only)
// =============================================================================

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JointAngles {
  elbowLeft:  number | null;
  elbowRight: number | null;
  kneeLeft:   number | null;
  kneeRight:  number | null;
  hipLeft:    number | null;
  hipRight:   number | null;
}

export interface PoseFrame {
  landmarks: NormalizedLandmark[];
  angles:    JointAngles;
}

// Landmark indices (MediaPipe BlazePose 33-point model)
export const LANDMARK_INDICES = {
  LEFT_SHOULDER:  11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW:     13,
  RIGHT_ELBOW:    14,
  LEFT_WRIST:     15,
  RIGHT_WRIST:    16,
  LEFT_HIP:       23,
  RIGHT_HIP:      24,
  LEFT_KNEE:      25,
  RIGHT_KNEE:     26,
  LEFT_ANKLE:     27,
  RIGHT_ANKLE:    28,
} as const;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let landmarker: PoseLandmarker | null = null;
let lastTimestampMs = -1;

// ---------------------------------------------------------------------------
// Init / dispose
// ---------------------------------------------------------------------------

export async function initPoseLandmarker(): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  lastTimestampMs = -1;
}

export function disposePoseLandmarker(): void {
  landmarker?.close();
  landmarker = null;
  lastTimestampMs = -1;
}

// Re-create if user scrubs backward (timestamps must be monotonically increasing)
async function ensureMonotonicity(timestampMs: number): Promise<void> {
  if (timestampMs < lastTimestampMs) {
    // Re-create the landmarker to reset internal timestamp state
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    lastTimestampMs = -1;
  }
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export function detectFrame(
  videoEl: HTMLVideoElement,
  timestampMs: number,
): PoseFrame | null {
  if (!landmarker) return null;
  if (videoEl.readyState < 2) return null;

  // Monotonicity guard (sync path — async re-create handled separately)
  if (timestampMs <= lastTimestampMs) return null;

  const result = landmarker.detectForVideo(videoEl, timestampMs);
  lastTimestampMs = timestampMs;

  if (!result.landmarks || result.landmarks.length === 0) return null;

  const lm = result.landmarks[0];
  const angles = computeAngles(lm);
  return { landmarks: lm, angles };
}

// Trigger async re-create when user seeks backward — call before detectFrame
export async function handleSeek(timestampMs: number): Promise<void> {
  if (timestampMs < lastTimestampMs) {
    await ensureMonotonicity(timestampMs);
  }
}

// ---------------------------------------------------------------------------
// Angle math
// ---------------------------------------------------------------------------

function angle3(
  a: NormalizedLandmark,
  b: NormalizedLandmark, // vertex
  c: NormalizedLandmark,
): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot  = abx * cbx + aby * cby;
  const magAB = Math.sqrt(abx * abx + aby * aby);
  const magCB = Math.sqrt(cbx * cbx + cby * cby);
  if (magAB === 0 || magCB === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

const VISIBILITY_THRESHOLD = 0.5;

function safeAngle(
  lm: NormalizedLandmark[],
  ai: number,
  bi: number,
  ci: number,
): number | null {
  const a = lm[ai], b = lm[bi], c = lm[ci];
  if (!a || !b || !c) return null;
  if (
    (a.visibility ?? 0) < VISIBILITY_THRESHOLD ||
    (b.visibility ?? 0) < VISIBILITY_THRESHOLD ||
    (c.visibility ?? 0) < VISIBILITY_THRESHOLD
  ) return null;
  return Math.round(angle3(a, b, c));
}

function computeAngles(lm: NormalizedLandmark[]): JointAngles {
  const I = LANDMARK_INDICES;
  return {
    elbowLeft:  safeAngle(lm, I.LEFT_SHOULDER,  I.LEFT_ELBOW,  I.LEFT_WRIST),
    elbowRight: safeAngle(lm, I.RIGHT_SHOULDER, I.RIGHT_ELBOW, I.RIGHT_WRIST),
    kneeLeft:   safeAngle(lm, I.LEFT_HIP,       I.LEFT_KNEE,   I.LEFT_ANKLE),
    kneeRight:  safeAngle(lm, I.RIGHT_HIP,      I.RIGHT_KNEE,  I.RIGHT_ANKLE),
    hipLeft:    safeAngle(lm, I.LEFT_SHOULDER,  I.LEFT_HIP,    I.LEFT_KNEE),
    hipRight:   safeAngle(lm, I.RIGHT_SHOULDER, I.RIGHT_HIP,   I.RIGHT_KNEE),
  };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const BADGE_COLORS = {
  elbow: '#4fc3f7',
  knee:  '#aef359',
  hip:   '#ffb74d',
} as const;

// Compute the actual video content area inside the canvas (objectFit: contain letterboxing)
function videoContentRect(
  canvasW: number,
  canvasH: number,
  videoW: number,
  videoH: number,
): { x: number; y: number; w: number; h: number } {
  if (!videoW || !videoH) return { x: 0, y: 0, w: canvasW, h: canvasH };
  const va = videoW / videoH;
  const ca = canvasW / canvasH;
  if (va > ca) {
    const h = canvasW / va;
    return { x: 0, y: (canvasH - h) / 2, w: canvasW, h };
  } else {
    const w = canvasH * va;
    return { x: (canvasW - w) / 2, y: 0, w, h: canvasH };
  }
}

export function drawPoseFrame(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  canvasW: number,
  canvasH: number,
  videoEl?: HTMLVideoElement | null,
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Resolve the actual video content rect (accounts for letterbox/pillarbox)
  const rect = videoContentRect(
    canvasW, canvasH,
    videoEl?.videoWidth ?? 0, videoEl?.videoHeight ?? 0,
  );

  // Helper: landmark → canvas pixel
  const px = (lm: NormalizedLandmark) => rect.x + lm.x * rect.w;
  const py = (lm: NormalizedLandmark) => rect.y + lm.y * rect.h;

  // Draw skeleton connectors
  const drawingUtils = new DrawingUtils(ctx);
  // Use DrawingUtils only for connectors — it uses normalized coords mapped to full canvas,
  // so we need to draw connectors manually too for correct letterbox offset.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineCap = 'round';
  PoseLandmarker.POSE_CONNECTIONS.forEach(({ start, end }) => {
    const a = frame.landmarks[start];
    const b = frame.landmarks[end];
    if (!a || !b) return;
    if ((a.visibility ?? 0) < VISIBILITY_THRESHOLD || (b.visibility ?? 0) < VISIBILITY_THRESHOLD) return;
    ctx.beginPath();
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
    ctx.stroke();
  });
  void drawingUtils; // imported but used only for POSE_CONNECTIONS reference above

  // Small solid dots (2px radius = visually sharp and small)
  ctx.globalAlpha = 1;
  frame.landmarks.forEach((lm) => {
    if ((lm.visibility ?? 0) < VISIBILITY_THRESHOLD) return;
    ctx.beginPath();
    ctx.arc(px(lm), py(lm), 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
  });

  // Angle badges
  drawBadge(ctx, frame.landmarks, frame.angles.elbowLeft,  LANDMARK_INDICES.LEFT_ELBOW,  rect, BADGE_COLORS.elbow);
  drawBadge(ctx, frame.landmarks, frame.angles.elbowRight, LANDMARK_INDICES.RIGHT_ELBOW, rect, BADGE_COLORS.elbow);
  drawBadge(ctx, frame.landmarks, frame.angles.kneeLeft,   LANDMARK_INDICES.LEFT_KNEE,   rect, BADGE_COLORS.knee);
  drawBadge(ctx, frame.landmarks, frame.angles.kneeRight,  LANDMARK_INDICES.RIGHT_KNEE,  rect, BADGE_COLORS.knee);
  drawBadge(ctx, frame.landmarks, frame.angles.hipLeft,    LANDMARK_INDICES.LEFT_HIP,    rect, BADGE_COLORS.hip);
  drawBadge(ctx, frame.landmarks, frame.angles.hipRight,   LANDMARK_INDICES.RIGHT_HIP,   rect, BADGE_COLORS.hip);
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  angle: number | null,
  landmarkIdx: number,
  rect: { x: number; y: number; w: number; h: number },
  color: string,
): void {
  if (angle === null) return;
  const lm = landmarks[landmarkIdx];
  if (!lm || (lm.visibility ?? 0) < VISIBILITY_THRESHOLD) return;

  const x = rect.x + lm.x * rect.w;
  const y = rect.y + lm.y * rect.h;
  const text = `${angle}°`;

  ctx.font = 'bold 11px sans-serif';
  const metrics = ctx.measureText(text);
  const padX = 5, padY = 3;
  const bw = metrics.width + padX * 2;
  const bh = 16;

  // Offset badge so it doesn't overlap the joint dot
  const bx = x + 6;
  const by = y - bh / 2;

  // Pill background
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  const r = bh / 2;
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.arc(bx + bw - r, by + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(bx + r, by + bh);
  ctx.arc(bx + r, by + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();

  // Text
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillText(text, bx + padX, by + bh - padY);
}
