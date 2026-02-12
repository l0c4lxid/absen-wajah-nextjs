export const BIOMETRIC_FRAME = {
  widthRatio: 0.62,
  heightRatio: 0.72,
  borderRadius: 24,
};

export type QualityIssue =
  | 'no-face'
  | 'outside-frame'
  | 'too-dark'
  | 'too-bright'
  | 'too-small'
  | 'too-large'
  | 'look-straight';

export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getFrameRect(containerWidth: number, containerHeight: number): FrameRect {
  const width = containerWidth * BIOMETRIC_FRAME.widthRatio;
  const height = containerHeight * BIOMETRIC_FRAME.heightRatio;
  return {
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height,
  };
}

export function averageDescriptor(descriptors: Float32Array[]): Float32Array {
  if (descriptors.length === 0) {
    return new Float32Array(0);
  }

  const length = descriptors[0].length;
  const result = new Float32Array(length);

  for (const descriptor of descriptors) {
    for (let i = 0; i < length; i += 1) {
      result[i] += descriptor[i];
    }
  }

  for (let i = 0; i < length; i += 1) {
    result[i] /= descriptors.length;
  }

  return result;
}
