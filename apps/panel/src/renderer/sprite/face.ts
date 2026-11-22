import { clipShape, line, type FaceShape } from './geom';

function eye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  px: number,
  py: number,
  ptam: number,
): void {
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1A1A1E';
  ctx.beginPath();
  ctx.ellipse(
    x + px + ptam / 2,
    y + py + (ptam + 1.4) / 2,
    ptam / 2,
    (ptam + 1.4) / 2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + px + ptam * 0.55 + 1.2, y + py + 1.2 + 1.2, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function arcEyes(ctx: CanvasRenderingContext2D, up: boolean): void {
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  for (const [x1, x2] of [
    [4, 14],
    [18, 28],
  ] as const) {
    ctx.beginPath();
    ctx.arc((x1 + x2) / 2, 18, 6, up ? Math.PI : 0, up ? 0 : Math.PI, !up);
    ctx.stroke();
  }
}

function cross(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  line(ctx, x, y, x + t, y + t, 2.6, '#FFFFFF');
  line(ctx, x + t, y, x, y + t, 2.6, '#FFFFFF');
}

/** Nueva-Cara legacy. No limpia canvas; dibuja en origen local. */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  lado: number,
  pose: string,
  color: string,
  frame: number,
  shape: FaceShape,
  mirar: 'izquierda' | 'derecha',
): void {
  ctx.save();
  if (pose === 'error') {
    ctx.translate(lado / 2, lado / 2);
    ctx.rotate((34 * Math.PI) / 180);
    ctx.translate(-lado / 2, -lado / 2);
  }

  ctx.fillStyle = color || '#8A8A8A';
  clipShape(ctx, lado, shape);
  ctx.fill();
  ctx.save();
  clipShape(ctx, lado, shape);
  ctx.clip();

  const step = Math.floor(frame);
  const blink =
    step % 7 === 3 &&
    (pose === 'trabajando' || pose === 'esperando' || pose === 'subagentes');

  if (pose === 'atento') {
    if (step % 18 === 0) {
      line(ctx, 3, 14, 15, 14, 2.6, '#FFFFFF');
      line(ctx, 17, 14, 29, 14, 2.6, '#FFFFFF');
    } else {
      const look = Math.floor(frame / 4) % 5;
      const map: [number, number][] = [
        [5.2, 1.0],
        [3.2, 0.6],
        [5.6, 3.8],
        [0.6, 1.0],
        [3.0, 3.2],
      ];
      const [px, py] = map[look] ?? [3.4, 4.2];
      eye(ctx, 2, 5, 13, 16, px, py, 6.2);
      eye(ctx, 17, 5, 13, 16, px, py, 6.2);
    }
  } else if (pose === 'terminado') {
    arcEyes(ctx, true);
  } else if (pose === 'detenido') {
    arcEyes(ctx, false);
  } else if (pose === 'error') {
    cross(ctx, 4, 10, 10);
    cross(ctx, 18, 10, 10);
  } else if (blink) {
    line(ctx, 4, 17, 14, 17, 2.6, '#FFFFFF');
    line(ctx, 18, 17, 28, 17, 2.6, '#FFFFFF');
  } else {
    let py = 3.4;
    let px = 3.0;
    let ptam = 5.4;
    let alto = 13;
    let yOjo = 9;
    let xOjo1 = 3;
    let xOjo2 = 17;
    let wOjo = 12;

    if (pose === 'trabajando' || pose === 'subagentes') {
      py = 4.2;
      px = mirar === 'izquierda' ? 1.2 : 4.8;
    }
    if (pose === 'leyendo') {
      const sway = Math.sin(frame * 0.45);
      px = 3.2 + sway * 2.2;
      py = 5.4 + Math.abs(sway) * 0.9;
      ptam = 5.2;
    }
    if (pose === 'planificando') {
      const look = Math.floor(frame / 4) % 5;
      const map: [number, number][] = [
        [5.2, 1.0],
        [3.2, 0.6],
        [5.6, 3.8],
        [0.6, 1.0],
        [3.0, 3.2],
      ];
      [px, py] = map[look] ?? [3, 3.2];
    }
    if (pose === 'esperando') {
      px = 2.6;
      py = 1.6;
      ptam = 6.6;
      alto = 14;
      yOjo = 8;
    }
    if (shape === 'triangulo') {
      yOjo = 17;
      alto = 8;
      ptam = 3.4;
      px = 1.6;
      py = 2.2;
      xOjo1 = 9;
      xOjo2 = 17;
      wOjo = 7;
    }
    eye(ctx, xOjo1, yOjo, wOjo, alto, px, py, ptam);
    eye(ctx, xOjo2, yOjo, wOjo, alto, px, py, ptam);
  }

  const brow = '#1A1A1E';
  if (pose === 'leyendo') {
    const pulse = Math.sin(frame * 0.45);
    line(ctx, 2, 5.6 + 0.5 * pulse, 13, 7.8 + 0.5 * pulse, 2.2, brow);
    line(ctx, 17, 2.4 + 0.3 * pulse, 30, 5.8 - 0.5 * pulse, 2.2, brow);
  }
  if (pose === 'planificando') {
    const look = Math.floor(frame / 4) % 5;
    if (look === 3) {
      line(ctx, 2, 2, 13, 6, 2.2, brow);
      line(ctx, 17, 5, 30, 8, 2.2, brow);
    } else if (look === 1) {
      line(ctx, 2, 3, 13, 3, 2.2, brow);
      line(ctx, 17, 3, 30, 3, 2.2, brow);
    } else if (look === 4) {
      line(ctx, 2, 6, 13, 6, 2.2, brow);
      line(ctx, 17, 6, 30, 6, 2.2, brow);
    } else {
      line(ctx, 2, 8, 13, 5, 2.2, brow);
      line(ctx, 17, 6, 30, 2, 2.2, brow);
    }
  }
  if (pose === 'esperando' && !blink) {
    line(ctx, 2, 7, 12, 3, 2.2, brow);
    line(ctx, 18, 3, 30, 7, 2.2, brow);
  }

  ctx.restore();
  ctx.restore();
}
