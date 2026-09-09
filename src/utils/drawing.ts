import { Point, AngleMeasurement, PoseLandmark } from '@/types';

export function getAngleBetweenPoints(a: Point, b: Point, c: Point): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

export function drawFreehand(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  lineWidth: number
) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  lineWidth: number
) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  color: string,
  lineWidth: number
) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawAngle(
  ctx: CanvasRenderingContext2D,
  vertex: Point,
  arm1End: Point,
  arm2End: Point,
  color: string,
  lineWidth: number
) {
  drawLine(ctx, vertex, arm1End, color, lineWidth);
  drawLine(ctx, vertex, arm2End, color, lineWidth);

  const angle = getAngleBetweenPoints(arm1End, vertex, arm2End);
  const midX = (arm1End.x + arm2End.x) / 2;
  const midY = (arm1End.y + arm2End.y) / 2;

  ctx.fillStyle = color;
  ctx.font = `bold 14px monospace`;
  ctx.fillText(`${angle.toFixed(1)}°`, midX + 10, midY - 10);
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  lineWidth: number
) {
  const headLength = Math.max(lineWidth * 4, 15);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

export function calculatePoseAngles(landmarks: PoseLandmark[]): AngleMeasurement[] {
  const angles: AngleMeasurement[] = [];

  const getIndex = (name: string): number | undefined => {
    const map: Record<string, number> = {
      'left_shoulder': 11, 'right_shoulder': 12,
      'left_elbow': 13, 'right_elbow': 14,
      'left_wrist': 15, 'right_wrist': 16,
      'left_hip': 23, 'right_hip': 24,
      'left_knee': 25, 'right_knee': 26,
      'left_ankle': 27, 'right_ankle': 28,
    };
    return map[name];
  };

  const getAngle = (
    name: string,
    jointA: string,
    jointB: string,
    jointC: string
  ) => {
    const idxA = getIndex(jointA);
    const idxB = getIndex(jointB);
    const idxC = getIndex(jointC);
    if (idxA === undefined || idxB === undefined || idxC === undefined) return;
    const a = landmarks[idxA];
    const b = landmarks[idxB];
    const c = landmarks[idxC];
    if (!a || !b || !c) return;

    const angle = getAngleBetweenPoints(
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
      { x: c.x, y: c.y }
    );
    angles.push({ name, angle, joints: { a, b, c } });
  };

  getAngle('Lead Elbow', 'left_shoulder', 'left_elbow', 'left_wrist');
  getAngle('Trail Elbow', 'right_shoulder', 'right_elbow', 'right_wrist');
  getAngle('Lead Hip', 'left_shoulder', 'left_hip', 'left_knee');
  getAngle('Trail Hip', 'right_shoulder', 'right_hip', 'right_knee');
  getAngle('Lead Knee', 'left_hip', 'left_knee', 'left_ankle');
  getAngle('Trail Knee', 'right_hip', 'right_knee', 'right_ankle');

  return angles;
}

export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
  [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
];

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  width: number,
  height: number,
  showAngles: boolean
) {
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#00ff88';

  for (const [start, end] of POSE_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!a || !b || (a.visibility !== undefined && a.visibility < 0.5) ||
        (b.visibility !== undefined && b.visibility < 0.5)) continue;

    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  for (const lm of landmarks) {
    if (lm.visibility !== undefined && lm.visibility < 0.5) continue;
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (showAngles) {
    const measurements = calculatePoseAngles(landmarks);
    for (const m of measurements) {
      const cx = m.joints.b.x * width;
      const cy = m.joints.b.y * height;
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${m.name}: ${m.angle.toFixed(1)}°`, cx + 10, cy - 10);
    }
  }
}
