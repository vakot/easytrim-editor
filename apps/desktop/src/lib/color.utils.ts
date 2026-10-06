import type { HexColor } from "./color.types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hsvToHex(hue: number, saturation: number, value: number): HexColor {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const v = clamp(value, 0, 100) / 100;

  const chroma = v * s;
  const segment = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));

  const [red, green, blue] =
    segment < 1
      ? [chroma, secondary, 0]
      : segment < 2
        ? [secondary, chroma, 0]
        : segment < 3
          ? [0, chroma, secondary]
          : segment < 4
            ? [0, secondary, chroma]
            : segment < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];

  const match = v - chroma;

  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function hexToHsv(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;

  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;

  const hue =
    delta === 0
      ? 0
      : ((maximum === red
          ? (green - blue) / delta
          : maximum === green
            ? (blue - red) / delta + 2
            : (red - green) / delta + 4) *
          60 +
          360) %
        360;

  const saturation = maximum === 0 ? 0 : delta / maximum;

  return {
    hue,
    saturation: saturation * 100,
    value: maximum * 100,
  };
}

function colorFromSpectrumPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  hue: number,
): HexColor {
  const saturation = clamp(x / width, 0, 1) * 100;
  const value = (1 - clamp(y / height, 0, 1)) * 100;

  return hsvToHex(hue, saturation, value);
}

function hueFromPosition(x: number, width: number) {
  return clamp(x / width, 0, 1) * 360;
}

// Оставь существующие HSL helpers, если они используются theme palette.
function hslToHex(hue: number, saturation: number, lightness: number): HexColor {
  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * (saturation / 100);
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));

  const [red, green, blue] =
    segment < 1
      ? [chroma, secondary, 0]
      : segment < 2
        ? [secondary, chroma, 0]
        : segment < 3
          ? [0, chroma, secondary]
          : segment < 4
            ? [0, secondary, chroma]
            : segment < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];

  const match = lightness / 100 - chroma / 2;

  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function hexToHsl(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;

  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  const hue =
    delta === 0
      ? 0
      : ((maximum === red
          ? (green - blue) / delta
          : maximum === green
            ? (blue - red) / delta + 2
            : (red - green) / delta + 4) *
          60 +
          360) %
        360;

  return {
    hue,
    saturation: saturation * 100,
  };
}

export { colorFromSpectrumPosition, hexToHsl, hexToHsv, hslToHex, hsvToHex, hueFromPosition };
