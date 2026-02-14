export interface FaceCandidate {
  _id: string;
  employeeId: string;
  name: string;
  role: string;
  faceDescriptors: number[][];
}

export interface FaceConflictResult {
  user: FaceCandidate | null;
  distance: number;
  score: number;
  supportHits: number;
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

function getUserMinDistance(inputDescriptor: number[], user: FaceCandidate): number {
  let best = 1.0;
  for (const descriptor of user.faceDescriptors ?? []) {
    const distance = euclideanDistance(inputDescriptor, descriptor);
    if (distance < best) {
      best = distance;
    }
  }
  return best;
}

export function detectFaceConflict(
  inputDescriptors: number[][],
  users: FaceCandidate[],
  options?: {
    strictThreshold?: number;
    supportThreshold?: number;
    minSupportHits?: number;
  }
): FaceConflictResult {
  const strictThreshold = options?.strictThreshold ?? 0.38;
  const supportThreshold = options?.supportThreshold ?? 0.42;
  const minSupportHits = options?.minSupportHits ?? 2;

  if (inputDescriptors.length === 0 || users.length === 0) {
    return { user: null, distance: 1.0, score: 0, supportHits: 0 };
  }

  let bestUser: FaceCandidate | null = null;
  let bestDistance = 1.0;
  let bestSupportHits = 0;

  for (const user of users) {
    let supportHits = 0;
    let userBestDistance = 1.0;

    for (const input of inputDescriptors) {
      const distance = getUserMinDistance(input, user);
      if (distance < userBestDistance) {
        userBestDistance = distance;
      }
      if (distance <= supportThreshold) {
        supportHits += 1;
      }
    }

    const isBetter = supportHits > bestSupportHits || (supportHits === bestSupportHits && userBestDistance < bestDistance);
    if (isBetter) {
      bestSupportHits = supportHits;
      bestDistance = userBestDistance;
      bestUser = user;
    }
  }

  const isConflict = bestUser && bestDistance <= strictThreshold && bestSupportHits >= minSupportHits;
  if (!isConflict) {
    return { user: null, distance: bestDistance, score: Math.max(0, Math.round((1 - bestDistance) * 100)), supportHits: bestSupportHits };
  }

  return {
    user: bestUser,
    distance: bestDistance,
    score: Math.max(0, Math.round((1 - bestDistance) * 100)),
    supportHits: bestSupportHits,
  };
}
