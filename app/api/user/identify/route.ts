
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/models/User';
import { findBestFaceMatch, type FaceCandidate } from '@/lib/face-match';

// Euclidean distance threshold for face matching
const MATCH_THRESHOLD = 0.5;

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

    const users = await User.find({})
      .select('_id name role employeeId faceDescriptors')
      .lean<FaceCandidate[]>();
    const match = findBestFaceMatch(faceDescriptor, users);
    const bestMatchUser = match.user;
    const minDistance = match.distance;

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

  } catch (error: unknown) {
    console.error('Identify Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
