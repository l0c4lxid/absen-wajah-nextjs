export interface FaceCandidate {
  _id: string;
  employeeId: string;
  name: string;
  role: string;
  faceDescriptors: number[][];
}

export function euclideanDistance(descriptor1: number[], descriptor2: number[]): number {
  if (descriptor1.length !== descriptor2.length) {
    return 1.0;
  }

  let sum = 0;
  for (let i = 0; i < descriptor1.length; i += 1) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

export function averageDescriptor(descriptors: number[][]): number[] {
  if (descriptors.length === 0) {
    return [];
  }

  const length = descriptors[0].length;
  const result = new Array<number>(length).fill(0);

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

export function findBestFaceMatch(
  inputDescriptor: number[],
  users: FaceCandidate[]
): { user: FaceCandidate | null; distance: number } {
  let bestUser: FaceCandidate | null = null;
  let bestDistance = 1.0;

  for (const user of users) {
    for (const descriptor of user.faceDescriptors ?? []) {
      const distance = euclideanDistance(inputDescriptor, descriptor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestUser = user;
      }
    }
  }

  return { user: bestUser, distance: bestDistance };
}
