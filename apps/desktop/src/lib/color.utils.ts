export type HexColor = `#${string}`;

export function colorFromSpectrumPosition(x: number, y: number, size: number): HexColor {
  const radius = size / 2;
  const horizontal = x - radius;
  const vertical = y - radius;
  const distance = Math.min(Math.hypot(horizontal, vertical) / radius, 1);
  const hue = (Math.atan2(vertical, horizontal) * 180) / Math.PI + 90;
  return hslToHex((hue + 360) % 360, distance * 100, 50);
}

export function hslToHex(hue: number, saturation: number, lightness: number): HexColor {
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

export function hexToHsl(hex: string) {
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
  return { hue, saturation: saturation * 100 };
}
