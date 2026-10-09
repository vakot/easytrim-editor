import type { TFunction } from "i18next";

import type { FrameRate } from "@/lib/tauri/media.types";

export const FRAME_RATE_OPTIONS = [6, 10, 15, 24, 25, 30, 50, 60, 120] as const;

interface ResolutionDimensions {
  height: number;
  width: number;
}

function resolutionOptions(dimensions: ResolutionDimensions, t: TFunction) {
  const options: { label: string; value: string }[] = [
    {
      label: t("export.resolution.sourceOption", {
        width: dimensions.width,
        height: dimensions.height,
      }),
      value: `${dimensions.width}x${dimensions.height}`,
    },
  ];

  for (const height of [2160, 1440, 1080]) {
    if (height < dimensions.height) {
      const width = Math.round((dimensions.width * height) / dimensions.height / 2) * 2;
      options.push({
        label: `${height}p \u00b7 ${width} \u00d7 ${height}`,
        value: `${width}x${height}`,
      });
    }
  }
  return options;
}

function frameRateFromInput(value: string): FrameRate | undefined {
  const normalizedValue = value.trim().replace(/\s*fps$/i, "");
  const rationalMatch = /^(\d+)\/(\d+)$/.exec(normalizedValue);
  if (rationalMatch) {
    const [, numerator, denominator] = rationalMatch;
    if (!numerator || !denominator) return undefined;
    return frameRateFromRatio(BigInt(numerator), BigInt(denominator));
  }

  const match = /^(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(normalizedValue);
  if (!match) return undefined;

  const integerPart = match[1] ?? "0";
  const decimalPart = (match[1] === undefined ? match[3] : match[2]) ?? "";
  const decimalPlaces = decimalPart.length;
  const denominator = 10n ** BigInt(decimalPlaces);
  const numerator = BigInt(`${integerPart}${decimalPart}`);
  return frameRateFromRatio(numerator, denominator);
}

function frameRateFromRatio(numerator: bigint, denominator: bigint): FrameRate | undefined {
  if (numerator <= 0n || denominator <= 0n || numerator > denominator * 120n) return undefined;

  const greatestCommonDivisor = (left: bigint, right: bigint): bigint =>
    right === 0n ? left : greatestCommonDivisor(right, left % right);

  const divisor = greatestCommonDivisor(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;
  const max = BigInt(0xffff_ffff);
  if (reducedNumerator > max || reducedDenominator > max) return undefined;

  return { denominator: Number(reducedDenominator), numerator: Number(reducedNumerator) };
}

function frameRateToInput(frameRate: FrameRate | undefined): string {
  if (!frameRate) return "";
  const value = frameRate.numerator / frameRate.denominator;
  if (Number(value.toFixed(6)) === 0) {
    return `${frameRate.numerator}/${frameRate.denominator} FPS`;
  }
  return `${Number(value.toFixed(6))} FPS`;
}

export { frameRateFromInput, frameRateToInput, resolutionOptions };
