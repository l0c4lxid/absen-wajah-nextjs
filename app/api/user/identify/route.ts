
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { User, IUser } from '@/models/User';

// Euclidean distance threshold for face matching
const MATCH_THRESHOLD = 0.5;

function getEuclideanDistance(descriptor1: number[], descriptor2: number[]): number {
  if (descriptor1.length !== descriptor2.length) return 1.0;
  
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { faceDescriptor } = await req.json();

    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
       return NextResponse.json(
        { error: 'Invalid face descriptor' },
        { status: 400 }
      );
    }

    const users = await User.find({});
    
    let bestMatchUser: IUser | null = null;
    let minDistance = 1.0;

    for (const user of users) {
      if (user.faceDescriptors && Array.isArray(user.faceDescriptors)) {
          // Check against all descriptors for this user and find the best match (minimum distance)
          let userMinDistance = 1.0;
          
          for (const storedDescriptor of user.faceDescriptors) {
               const distance = getEuclideanDistance(faceDescriptor, storedDescriptor);
               if (distance < userMinDistance) {
                   userMinDistance = distance;
               }
          }

          // If this user's best match is the global best so far, record it
          if (userMinDistance < minDistance) {
              minDistance = userMinDistance;
              bestMatchUser = user;
          }
      }
    }

    if (!bestMatchUser || minDistance > MATCH_THRESHOLD) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const matchScore = Math.max(0, Math.round((1 - minDistance) * 100));

    return NextResponse.json({
      user: bestMatchUser ? {
        _id: bestMatchUser._id,
        name: bestMatchUser.name,
        role: bestMatchUser.role,
        employeeId: bestMatchUser.employeeId,
      } : null,
      score: matchScore
    });

  } catch (error: any) {
    console.error('Identify Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
