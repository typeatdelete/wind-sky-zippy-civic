import { GUIDES } from "@/lib/pitch";

export type FieldDraw = {
  x: number;
  y: number;
  inside: boolean;
  muted: boolean;
  activeMidi: number | null;
  trail: { x: number; y: number }[];
};

type Rgb = [number, number, number];

export type FieldColors = {
  loud: Rgb;
  field: Rgb;
  quiet: Rgb;
  cream: Rgb;
  amber: Rgb;
};

function cssRgb(color: string): Rgb {
  const probe = document.createElement("span");
  probe.style.color = color;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const parts = computed.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return [243, 234, 220];
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

export function readFieldColors(): FieldColors | null {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string) => style.getPropertyValue(name).trim();
  const loud = pick("--color-field-loud");
  const amber = pick("--color-primary");
  if (!loud || !amber) return null;
  return {
    loud: cssRgb(loud),
    field: cssRgb(pick("--color-field") || loud),
    quiet: cssRgb(pick("--color-field-quiet") || loud),
    cream: cssRgb(pick("--color-fg") || amber),
    amber: cssRgb(amber),
  };
}

function rgba(rgb: Rgb, alpha: number) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function drawField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: FieldColors,
  state: FieldDraw,
) {
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, rgba(colors.loud, 1));
  background.addColorStop(0.42, rgba(colors.field, 1));
  background.addColorStop(1, rgba(colors.quiet, 1));
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const x0 = (12 / 36) * width;
  const x1 = (24 / 36) * width;
  ctx.fillStyle = rgba(colors.cream, 0.035);
  ctx.fillRect(x0, 0, x1 - x0, height);

  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(colors.cream, 0.16);
  for (const fraction of [1 / 3, 2 / 3]) {
    const y = Math.round(fraction * height) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (const guide of GUIDES) {
    const x = Math.round(guide.t * width) + 0.5;
    const hot = state.inside && state.activeMidi === guide.midi;
    ctx.strokeStyle = hot
      ? rgba(colors.amber, 0.95)
      : guide.anchor
        ? rgba(colors.cream, 0.55)
        : guide.natural
          ? rgba(colors.cream, 0.3)
          : rgba(colors.cream, 0.12);
    ctx.lineWidth = hot ? 2 : 1;
    if (hot) {
      ctx.shadowColor = rgba(colors.amber, 0.8);
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const vignette = ctx.createRadialGradient(
    width / 2,
    height * 0.45,
    Math.min(width, height) * 0.2,
    width / 2,
    height * 0.5,
    Math.max(width, height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  if (!state.inside) return;

  const px = Math.min(1, Math.max(0, state.x)) * width;
  const py = Math.min(1, Math.max(0, state.y)) * height;

  for (let i = 0; i < state.trail.length; i++) {
    const point = state.trail[i];
    const age = (i + 1) / state.trail.length;
    ctx.fillStyle = rgba(colors.amber, age * 0.18);
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, 3 + age * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = rgba(colors.amber, state.muted ? 0.28 : 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, height);
  ctx.moveTo(0, py);
  ctx.lineTo(width, py);
  ctx.stroke();

  if (state.muted) {
    ctx.strokeStyle = rgba(colors.cream, 0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  const glow = ctx.createRadialGradient(px, py, 0, px, py, 42);
  glow.addColorStop(0, rgba(mix(colors.cream, colors.amber, 0.25), 0.95));
  glow.addColorStop(0.2, rgba(colors.amber, 0.72));
  glow.addColorStop(1, rgba(colors.amber, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(px, py, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgba(colors.cream, 1);
  ctx.beginPath();
  ctx.arc(px, py, 3.2, 0, Math.PI * 2);
  ctx.fill();
}
