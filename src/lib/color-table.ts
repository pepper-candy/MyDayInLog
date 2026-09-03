function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const chroma = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const mix =
      light - chroma * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * mix)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export const CANDY_HUE_START = 38;
export const CANDY_S = 46;
export const CANDY_L_TOP = 74;
export const CANDY_L_MID = 56;
export const CANDY_L_BOT = 40;

export function candyHue(tx: number): number {
  return (CANDY_HUE_START + clamp(tx, 0, 1) * 360) % 360;
}

export function candyLight(ty: number): number {
  const t = clamp(ty, 0, 1);
  if (t <= 0.5) return lerp(CANDY_L_TOP, CANDY_L_MID, t * 2);
  return lerp(CANDY_L_MID, CANDY_L_BOT, (t - 0.5) * 2);
}

export function candyColorAt(tx: number, ty: number): string {
  return hslToHex(candyHue(tx), CANDY_S, candyLight(ty));
}

export function candyPosFromHex(hex: string): { x: number; y: number } {
  const hsl = hexToHsl(hex);
  const x = ((hsl.h - CANDY_HUE_START + 360) % 360) / 360;
  let y: number;
  if (hsl.l >= CANDY_L_MID) {
    y =
      0.5 *
      (1 -
        (hsl.l - CANDY_L_MID) / Math.max(1, CANDY_L_TOP - CANDY_L_MID));
  } else {
    y =
      0.5 +
      0.5 *
        ((CANDY_L_MID - hsl.l) / Math.max(1, CANDY_L_MID - CANDY_L_BOT));
  }
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

export const ACTIVITY_COLOR_TABLE_DEFAULT = candyColorAt(0, 0.5);

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = parseHex(hex);
  if (!rgb) return { h: CANDY_HUE_START, s: CANDY_S, l: CANDY_L_MID };
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === red) h = ((green - blue) / d) % 6;
  else if (max === green) h = (blue - red) / d + 2;
  else h = (red - green) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}
