import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/models/User';

const VALID_ROLES = new Set(['Surgeon', 'Doctor', 'Nurse', 'Admin']);

interface CreateUserBody {
  name?: string;
  role?: string;
  employeeId?: string;
  faceDescriptors?: number[][];
}

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const limitRaw = Number(searchParams.get('limit') ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const query = q
      ? {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { employeeId: { $regex: q, $options: 'i' } },
            { role: { $regex: q, $options: 'i' } },
          ],
        }
      : {};

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id name role employeeId createdAt faceDescriptors')
      .lean();

    const result = users.map((user) => ({
      _id: String(user._id),
      name: user.name,
      role: user.role,
      employeeId: user.employeeId,
      createdAt: user.createdAt,
      descriptorsCount: Array.isArray(user.faceDescriptors) ? user.faceDescriptors.length : 0,
    }));

    return NextResponse.json({ users: result, total: result.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = (await req.json()) as CreateUserBody;
    const { name, role, employeeId, faceDescriptors } = body;

    if (
      !name ||
      !employeeId ||
      !Array.isArray(faceDescriptors) ||
      faceDescriptors.length === 0 ||
      !faceDescriptors.every((descriptor) => Array.isArray(descriptor) && descriptor.length > 0)
    ) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (role && !VALID_ROLES.has(role)) {
      return NextResponse.json({ error: 'Invalid role value' }, { status: 400 });
    }

    const normalizedEmployeeId = employeeId.trim().toUpperCase();
    const duplicate = await User.findOne({ employeeId: normalizedEmployeeId }).select('_id name employeeId');
    if (duplicate) {
      return NextResponse.json(
        {
          error: 'Employee ID already exists',
          code: 'EMPLOYEE_EXISTS',
          existingUser: {
            _id: duplicate._id,
            name: duplicate.name,
            employeeId: duplicate.employeeId,
          },
        },
        { status: 409 }
      );
    }

    const user = await User.create({
      name: name.trim(),
      role: role ?? 'Doctor',
      employeeId: normalizedEmployeeId,
      faceDescriptors,
    });

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          _id: user._id,
          name: user.name,
          role: user.role,
          employeeId: user.employeeId,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
