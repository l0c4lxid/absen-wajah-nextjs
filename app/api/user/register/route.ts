
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/models/User';
import { detectFaceConflict, type FaceCandidate } from '@/lib/face-match';

const VALID_ROLES = new Set(['Surgeon', 'Doctor', 'Nurse', 'Admin']);

interface RegisterBody {
  name?: string;
  role?: string;
  employeeId?: string;
  faceDescriptors?: number[][];
  confirmOverwrite?: boolean;
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = (await req.json()) as RegisterBody;
    const { name, role, employeeId, faceDescriptors, confirmOverwrite = false } = body;

    if (
      !name ||
      !employeeId ||
      !Array.isArray(faceDescriptors) ||
      faceDescriptors.length === 0 ||
      !faceDescriptors.every((descriptor) => Array.isArray(descriptor) && descriptor.length > 0)
    ) {
      return NextResponse.json(
        { error: 'Missing required fields or invalid face descriptors' },
        { status: 400 }
      );
    }

    if (role && !VALID_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Invalid role value' },
        { status: 400 }
      );
    }

    const normalizedEmployeeId = employeeId.trim().toUpperCase();
    const existingUser = await User.findOne({ employeeId: normalizedEmployeeId });

    const otherUsers = await User.find(
      existingUser
        ? { _id: { $ne: existingUser._id } }
        : {}
    )
      .select('_id employeeId name role faceDescriptors')
      .lean<FaceCandidate[]>();

    const faceConflict = detectFaceConflict(faceDescriptors, otherUsers, {
      strictThreshold: 0.38,
      supportThreshold: 0.42,
      minSupportHits: Math.min(3, Math.max(2, Math.floor(faceDescriptors.length / 3))),
    });

    if (faceConflict.user) {
      return NextResponse.json(
        {
          error: 'Face descriptor is already associated with another user',
          code: 'FACE_ALREADY_REGISTERED',
          conflictUser: {
            _id: faceConflict.user._id,
            employeeId: faceConflict.user.employeeId,
            name: faceConflict.user.name,
            role: faceConflict.user.role,
          },
          score: faceConflict.score,
          supportHits: faceConflict.supportHits,
        },
        { status: 409 }
      );
    }

    if (existingUser) {
      if (!confirmOverwrite) {
        return NextResponse.json(
          {
            error: 'Employee ID already exists',
            code: 'EMPLOYEE_EXISTS',
            existingUser: {
              _id: existingUser._id,
              name: existingUser.name,
              role: existingUser.role,
              employeeId: existingUser.employeeId,
            },
          },
          { status: 409 }
        );
      }

      existingUser.name = name.trim();
      existingUser.role = (role ?? existingUser.role) as 'Surgeon' | 'Doctor' | 'Nurse' | 'Admin';
      existingUser.faceDescriptors = faceDescriptors;
      await existingUser.save();

      return NextResponse.json(
        { message: 'User updated successfully', user: existingUser, action: 'updated' },
        { status: 200 }
      );
    }

    const newUser = await User.create({
      name: name.trim(),
      role: role ?? 'Doctor',
      employeeId: normalizedEmployeeId,
      faceDescriptors,
    });

    return NextResponse.json(
      { message: 'User registered successfully', user: newUser, action: 'created' },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Registration Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
