import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/models/User';
import { findBestFaceMatch, type FaceCandidate } from '@/lib/face-match';

const FACE_CONFLICT_THRESHOLD = 0.45;

interface ValidateBody {
  employeeId?: string;
  faceDescriptor?: number[];
  excludeUserId?: string;
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = (await req.json()) as ValidateBody;
    const employeeId = body.employeeId?.trim().toUpperCase();

    const employeeMatch = employeeId
      ? await User.findOne({ employeeId })
          .select('_id name role employeeId')
          .lean<{ _id: string; name: string; role: string; employeeId: string } | null>()
      : null;

    let faceConflict: {
      user: { _id: string; name: string; role: string; employeeId: string };
      score: number;
    } | null = null;

    if (body.faceDescriptor && Array.isArray(body.faceDescriptor) && body.faceDescriptor.length > 0) {
      const query = body.excludeUserId ? { _id: { $ne: body.excludeUserId } } : {};
      const users = await User.find(query)
        .select('_id name role employeeId faceDescriptors')
        .lean<FaceCandidate[]>();

      const match = findBestFaceMatch(body.faceDescriptor, users);
      if (match.user && match.distance <= FACE_CONFLICT_THRESHOLD) {
        faceConflict = {
          user: {
            _id: match.user._id,
            name: match.user.name,
            role: match.user.role,
            employeeId: match.user.employeeId,
          },
          score: Math.max(0, Math.round((1 - match.distance) * 100)),
        };
      }
    }

    return NextResponse.json({
      employeeExists: Boolean(employeeMatch),
      employee: employeeMatch
        ? {
            _id: employeeMatch._id,
            name: employeeMatch.name,
            role: employeeMatch.role,
            employeeId: employeeMatch.employeeId,
          }
        : null,
      faceConflict,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
