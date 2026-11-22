export type FaceShape = 'cuadrado' | 'circulo' | 'triangulo';

export function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
  opacity = 1,
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export function clipShape(
  ctx: CanvasRenderingContext2D,
  lado: number,
  shape: FaceShape,
): void {
  ctx.beginPath();
  if (shape === 'circulo') {
    ctx.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
  } else if (shape === 'triangulo') {
    ctx.moveTo(lado / 2, 1);
    ctx.lineTo(lado - 1, lado - 1);
    ctx.lineTo(1, lado - 1);
    ctx.closePath();
  } else {
    const r = 4;
    ctx.moveTo(r, 0);
    ctx.arcTo(lado, 0, lado, lado, r);
    ctx.arcTo(lado, lado, 0, lado, r);
    ctx.arcTo(0, lado, 0, 0, r);
    ctx.arcTo(0, 0, lado, 0, r);
    ctx.closePath();
  }
}
