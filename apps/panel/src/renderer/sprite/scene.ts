import { drawFace } from './face';
import { fillRoundRect, line, type FaceShape } from './geom';

const W = 56;
const H = 66;
const LADO = 32;

type Obra = {
  x: number;
  y: number;
  mirar: 'izquierda' | 'derecha';
  ladrilloX: number;
  puestos: number;
  sueltoY: number;
  caminando: boolean;
  paso: number;
};

function obraPaso(frame: number): Obra {
  const capacidad = 5;
  const pasosObra = 1 + capacidad * 2;
  const pasosCamino = 6;
  const pasosSitio = pasosObra + pasosCamino;
  const paso = frame % pasosSitio;
  let x = 0;
  let ladrilloX = 40;
  const mirar: 'izquierda' | 'derecha' = 'derecha';
  const caminando = paso >= pasosObra;
  let puestos = 0;
  let sueltoY = -1;
  let y = 18;
  if (caminando) {
    const t = paso - pasosObra;
    y = 18 + 3 * Math.abs(Math.sin((t * Math.PI) / 2));
    puestos = capacidad;
    ladrilloX = 40 - (52 * t) / (pasosCamino - 1);
  } else if (paso >= 1) {
    const trabajo = paso - 1;
    const indice = Math.floor(trabajo / 2);
    const fase = trabajo % 2;
    const colocando = fase < 1;
    const aterriza = 50 - indice * 7;
    if (colocando) {
      puestos = indice;
      sueltoY = aterriza - 16 + 16 * fase;
    } else {
      puestos = indice + 1;
    }
  }
  return { x, y, mirar, ladrilloX, puestos, sueltoY, caminando, paso };
}

function addBricks(ctx: CanvasRenderingContext2D, obra: Obra): void {
  const alto = 6;
  const ancho = 12;
  const base = 50;
  for (let i = 0; i < obra.puestos; i++) {
    fillRoundRect(
      ctx,
      obra.ladrilloX,
      base - i * 7,
      ancho,
      alto,
      1,
      i % 2 === 1 ? '#F0C56A' : '#E2B34C',
    );
  }
  if (obra.sueltoY >= 0) {
    fillRoundRect(ctx, obra.ladrilloX, obra.sueltoY, ancho, alto, 1, '#FFE7A3');
  }
}

function addArms(ctx: CanvasRenderingContext2D, obra: Obra): void {
  const brazo = '#F4F4F4';
  const yHombro = obra.y + 26;
  const izqX = obra.x;
  const derX = obra.x + LADO;
  if (obra.caminando) {
    const swing = 7 * Math.cos(obra.paso * Math.PI);
    line(ctx, izqX, yHombro, izqX + swing, yHombro + 12, 2.4, brazo);
    line(ctx, derX, yHombro, derX - swing, yHombro + 12, 2.4, brazo);
    return;
  }
  let destinoY = yHombro + 8;
  if (obra.sueltoY >= 0) destinoY = obra.sueltoY + 3;
  else if (obra.puestos > 0) destinoY = 50 - (obra.puestos - 1) * 7 + 3;
  line(ctx, derX, yHombro, obra.ladrilloX, destinoY, 2.4, brazo);
  line(ctx, izqX, yHombro, izqX - 8, yHombro + 10, 2.4, brazo);
}

function addLupa(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
): void {
  const vaiven = Math.sin(frame * 0.45);
  ctx.save();
  ctx.translate(x + (vaiven * 8), y + Math.abs(Math.cos(frame * 0.45)) * 2);
  ctx.translate(8, 18);
  ctx.rotate(((18 + vaiven * 16) * Math.PI) / 180);
  ctx.translate(-8, -18);
  ctx.strokeStyle = '#F4F4F4';
  ctx.fillStyle = '#D6E6FF';
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(7, 19, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
  line(ctx, 11, 14, 24, 3, 2.2, '#F4F4F4');
  ctx.restore();
}

function addSmoke(ctx: CanvasRenderingContext2D, frame: number): void {
  const ciclo = 9;
  for (let i = 0; i < 3; i++) {
    const t = (frame + i * 3) % ciclo;
    const w = 4 + t * 0.7;
    ctx.fillStyle = i % 2 === 1 ? '#BDBDBD' : '#F0F0F0';
    ctx.globalAlpha = Math.max(0.1, 0.95 - t / ciclo);
    ctx.beginPath();
    ctx.ellipse(18 + i * 7 + w / 2, 14 - t * 2.2 + (w * 0.75) / 2, w / 2, (w * 0.75) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function addZeta(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opacity: number,
): void {
  line(ctx, x, y, x + w, y, 1.7, '#FFFFFF', opacity);
  line(ctx, x + w, y, x, y + h, 1.7, '#FFFFFF', opacity);
  line(ctx, x, y + h, x + w, y + h, 1.7, '#FFFFFF', opacity);
}

function addQuestion(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const flot = Math.sin(frame * 0.9) * 1.2;
  ctx.save();
  ctx.translate(x + 5, y + 8 + flot);
  ctx.rotate((Math.sin(frame * 0.55) * 7 * Math.PI) / 180);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 0);
  ctx.restore();
}

type Acarreo = {
  x: number;
  lleva: boolean;
  salto: number;
  mirar: 'izquierda' | 'derecha';
  hechos: number;
  subida: number;
  cogiendo: boolean;
  colocando: boolean;
};

function pasoAcarreo(frame: number, indice: number): Acarreo {
  const periodos = [8, 11, 6];
  const periodo = periodos[indice % 3]!;
  const tick = frame + indice * 5;
  const t = (tick % periodo) / periodo;
  let hechos = Math.floor(tick / periodo);
  const xPila = 2;
  const xMuro = 28;
  let x = xPila;
  let lleva = false;
  let salto = 0;
  let mirar: 'izquierda' | 'derecha' = 'izquierda';
  const estilo = indice % 3;
  const pulso = Math.abs(Math.sin((frame * Math.PI) / 2));
  if (t < 0.2) {
    x = xPila;
    mirar = 'izquierda';
    if (estilo === 2) salto = 3 * pulso;
  } else if (t < 0.62) {
    const u = (t - 0.2) / 0.42;
    x = xPila + (xMuro - xPila) * u;
    lleva = true;
    mirar = 'derecha';
    if (estilo === 0) salto = 5 * pulso;
    if (estilo === 2 && u > 0.35 && u < 0.7) salto = 6 * pulso;
  } else if (t < 0.8) {
    x = xMuro;
    lleva = t < 0.72;
    mirar = 'derecha';
  } else {
    const u = (t - 0.8) / 0.2;
    x = xMuro + (xPila - xMuro) * u;
    mirar = 'izquierda';
    if (estilo === 1) salto = 3 * pulso;
  }
  const centro = 0.72;
  const ancho = 1.05 / periodo;
  const distancia = Math.abs(t - centro);
  let subida = 0;
  if (distancia < ancho) subida = Math.cos((distancia / ancho) * (Math.PI / 2));
  if (t >= centro) hechos++;
  return {
    x,
    lleva,
    salto,
    mirar,
    hechos,
    subida,
    cogiendo: t < 0.2,
    colocando: subida > 0.8 && t < centro,
  };
}

function capacidadMuro(): number {
  return (Math.floor(59 / 3) + 1) * 2;
}

function puestosSub(frame: number, n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) total += pasoAcarreo(frame, i).hechos;
  return total;
}

function viaje(frame: number, n: number) {
  const capacidad = capacidadMuro();
  const pasosViaje = 6;
  let complecion = -1;
  const base = Math.floor(frame);
  for (let k = 0; k < pasosViaje; k++) {
    const f = base - k;
    if (f < 1) break;
    const p = puestosSub(f, n);
    const prev = puestosSub(f - 1, n);
    const nivel = Math.floor(p / capacidad);
    const nivelPrev = Math.floor(prev / capacidad);
    if (p > 0 && nivel > nivelPrev) {
      complecion = f;
      break;
    }
  }
  const caminando = complecion >= 0;
  let dx = 0;
  let bob = 0;
  let menea = 0;
  if (caminando) {
    const t = frame - complecion;
    dx = (-52 * t) / (pasosViaje - 1);
    bob = 3 * Math.abs(Math.sin((t * Math.PI) / 2));
    menea = -2.5 * Math.cos(t * Math.PI);
  }
  return { caminando, dx, bob, menea };
}

function miniWorker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
  indice: number,
  mirar: 'izquierda' | 'derecha',
  lleva: boolean,
  color: string,
  forma: FaceShape,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.5, 0.5);
  drawFace(ctx, 32, 'trabajando', color, frame + indice, forma, mirar);
  const brazo = '#F4F4F4';
  let hombroX = 32;
  let manoX = 26;
  let otroX = 0;
  let otroFin = -4;
  let manoY = lleva ? 18 : 24;
  if (mirar === 'izquierda') {
    hombroX = 0;
    manoX = 6;
    otroX = 32;
    otroFin = 36;
  }
  if (lleva) fillRoundRect(ctx, manoX - 4, manoY - 2, 10, 5, 1, '#FFE7A3');
  line(ctx, hombroX, 26, manoX, manoY, 2.2, brazo);
  const swing = -4 * Math.cos((frame + indice) * Math.PI);
  line(ctx, otroX, 26, otroFin + swing, 32, 2.2, brazo);
  ctx.restore();
}

function subPos(frame: number, cuenta: number) {
  let n = cuenta;
  if (n < 1) n = 1;
  if (n > 3) n = 3;
  const v = viaje(frame, n);
  let x = -8;
  let y = 30;
  if (v.caminando) {
    x += v.menea;
    y += v.bob;
  }
  return { x, y, n, v };
}

function drawSubagentesScene(
  ctx: CanvasRenderingContext2D,
  frame: number,
  n: number,
  v: ReturnType<typeof viaje>,
): void {
  const pasos: Acarreo[] = [];
  let hayQuienCoge = false;
  for (let i = 0; i < n; i++) {
    const p = pasoAcarreo(frame, i);
    pasos.push(p);
    if (p.cogiendo) hayQuienCoge = true;
  }
  const dx = v.caminando ? v.dx : 0;
  const bob = v.caminando ? v.bob : 0;
  const menea = v.caminando ? v.menea : 0;
  fillRoundRect(ctx, 1 + dx, 59, 6, 3, 1, '#E2B34C');
  fillRoundRect(ctx, 8 + dx, 59, 6, 3, 1, '#F0C56A');
  if (!hayQuienCoge || v.caminando) fillRoundRect(ctx, 4 + dx, 56, 6, 3, 1, '#E2B34C');
  let puestos = 0;
  for (const p of pasos) puestos += p.hechos;
  const capacidad = capacidadMuro();
  let enMuro = puestos % capacidad;
  if (v.caminando) enMuro = capacidad;
  for (let b = 0; b < enMuro; b++) {
    const col = b % 2;
    const fila = Math.floor(b / 2);
    fillRoundRect(
      ctx,
      44 + dx + col * 6,
      59 - fila * 3,
      6,
      3,
      1,
      b % 2 === 1 ? '#F0C56A' : '#E2B34C',
    );
  }
  const tonos: string[] = ['#4FA3FF', '#3DDC97', '#E056C7'];
  const formas: FaceShape[] = ['cuadrado', 'circulo', 'triangulo'];
  let extra = 0;
  for (let i = 0; i < n; i++) {
    const paso = pasos[i]!;
    if (v.caminando) {
      miniWorker(
        ctx,
        4 + i * 16 + menea,
        46 + bob,
        frame,
        i,
        'derecha',
        false,
        tonos[i % 3]!,
        formas[i % 3]!,
      );
      continue;
    }
    const llevaEnMano = paso.lleva && !paso.colocando;
    let salto = paso.salto;
    const apunta = paso.colocando || paso.subida > 0;
    let slot = -1;
    if (apunta && enMuro + extra < capacidad) {
      slot = enMuro + extra;
      const filaSalto = Math.floor(slot / 2);
      const yLadrillo = 59 - filaSalto * 3;
      if (yLadrillo < 46) {
        const meta = 46 - yLadrillo;
        salto = paso.colocando ? meta : meta * paso.subida;
      }
      extra++;
    }
    miniWorker(
      ctx,
      paso.x,
      46 - salto,
      frame,
      i,
      paso.mirar,
      llevaEnMano,
      tonos[i % 3]!,
      formas[i % 3]!,
    );
    if (paso.colocando && slot >= 0) {
      const col = slot % 2;
      const fila = Math.floor(slot / 2);
      fillRoundRect(ctx, 44 + col * 6, 59 - fila * 3, 6, 3, 1, '#FFE7A3');
    }
  }
}
/** Nuevo-Sprite legacy 56×66. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  pose: string,
  color: string,
  frame: number,
  cuenta = 2,
): void {
  ctx.clearRect(0, 0, W, H);
  let p = pose;
  const known = new Set([
    'trabajando',
    'subagentes',
    'planificando',
    'leyendo',
    'esperando',
    'terminado',
    'atento',
    'error',
    'detenido',
    'vacio',
  ]);
  if (!known.has(p)) p = 'detenido';

  let obra: Obra | null = null;
  let mirar: 'izquierda' | 'derecha' = 'derecha';
  if (p === 'trabajando') {
    obra = obraPaso(frame);
    mirar = obra.mirar;
  }
  if (obra) addBricks(ctx, obra);

  let x = 12;
  let y = 14;
  let sub: ReturnType<typeof subPos> | null = null;
  if (obra) {
    x = obra.x;
    y = obra.y;
  }
  if (p === 'esperando') y = 28;
  if (p === 'subagentes') {
    sub = subPos(frame, cuenta);
    x = sub.x;
    y = sub.y;
  }
  if (p === 'atento') y = 16;
  let alientoOnda = 0;
  if (p === 'detenido') {
    alientoOnda = Math.max(0, Math.sin(frame * 0.45));
    y = 26 - alientoOnda;
  }
  if (p === 'terminado') y = 14 - (1 + Math.cos(frame * Math.PI));

  ctx.save();
  ctx.translate(x, y);
  if (p === 'esperando') {
    const pasoCabeza = Math.floor(frame / 3) % 10;
    let angulo = 0;
    if (pasoCabeza === 2 || pasoCabeza === 3) angulo = -14;
    if (pasoCabeza === 6 || pasoCabeza === 7) angulo = 14;
    if (angulo) {
      ctx.translate(LADO / 2, LADO / 2);
      ctx.rotate((angulo * Math.PI) / 180);
      ctx.translate(-LADO / 2, -LADO / 2);
    }
  }
  if (p === 'detenido') {
    const sx = 1 + 0.012 * alientoOnda;
    const sy = 1 + 0.03 * alientoOnda;
    ctx.translate(LADO / 2, LADO);
    ctx.scale(sx, sy);
    ctx.translate(-LADO / 2, -LADO);
  }
  // Subagentes: cara principal también 'trabajando' (legacy)
  drawFace(ctx, LADO, p === 'subagentes' ? 'trabajando' : p, color, frame, 'cuadrado', mirar);
  ctx.restore();

  if (p === 'leyendo') addLupa(ctx, x + 8, y + 18, frame);
  if (p === 'error') addSmoke(ctx, frame);
  if (obra) addArms(ctx, obra);
  if (p === 'esperando') addQuestion(ctx, 22, 1, frame);
  if (sub) drawSubagentesScene(ctx, frame, sub.n, sub.v);
  if (p === 'detenido') {
    const ciclo = 48;
    const zx = [8, 18, 29];
    const zy = [16, 10, 5];
    const zw = [7, 8, 8];
    const zh = [5, 6, 6];
    for (let i = 0; i < 3; i++) {
      let fase = (frame - i * 16) % ciclo;
      if (fase < 0) fase += ciclo;
      const t = fase / ciclo;
      if (t >= 0.72) continue;
      let op = 1;
      if (t < 0.12) op = t / 0.12;
      else if (t > 0.55) op = (0.72 - t) / 0.17;
      addZeta(ctx, zx[i]!, zy[i]! - t * 6, zw[i]!, zh[i]!, op);
    }
  }
}

export const SPRITE_W = W;
export const SPRITE_H = H;
