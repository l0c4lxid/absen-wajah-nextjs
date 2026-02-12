import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/models/User';
import { Attendance } from '@/models/Attendance';

const VALID_ROLES = new Set(['Surgeon', 'Doctor', 'Nurse', 'Admin']);

interface UpdateUserBody {
  name?: string;
  role?: string;
  employeeId?: string;
  faceDescriptors?: number[][];
}

interface DeleteUserBody {
  confirmEmployeeId?: string;
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await context.params;
    const user = await User.findById(id).select('_id name role employeeId createdAt faceDescriptors').lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        _id: String(user._id),
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
        createdAt: user.createdAt,
        descriptorsCount: user.faceDescriptors?.length ?? 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await context.params;
    const body = (await req.json()) as UpdateUserBody;
    const { name, role, employeeId } = body;

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (role && !VALID_ROLES.has(role)) {
      return NextResponse.json({ error: 'Invalid role value' }, { status: 400 });
    }

    if (employeeId && employeeId.trim().toUpperCase() !== user.employeeId) {
      const normalizedEmployeeId = employeeId.trim().toUpperCase();
      const duplicate = await User.findOne({ _id: { $ne: id }, employeeId: normalizedEmployeeId });
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
      user.employeeId = normalizedEmployeeId;
    }

    if (name) {
      user.name = name.trim();
    }
    if (role) {
      user.role = role as 'Surgeon' | 'Doctor' | 'Nurse' | 'Admin';
    }
    if (
      body.faceDescriptors &&
      Array.isArray(body.faceDescriptors) &&
      body.faceDescriptors.every((descriptor) => Array.isArray(descriptor) && descriptor.length > 0)
    ) {
      user.faceDescriptors = body.faceDescriptors;
    }

    await user.save();

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
        createdAt: user.createdAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as DeleteUserBody;
    const user = await User.findById(id).select('_id employeeId name');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (body.confirmEmployeeId?.trim().toUpperCase() !== user.employeeId) {
      return NextResponse.json(
        {
          error: 'Confirmation employeeId mismatch',
          code: 'DELETE_CONFIRMATION_FAILED',
        },
        { status: 400 }
      );
    }

    const attendanceDeleted = await Attendance.deleteMany({ user: user._id });
    await User.findByIdAndDelete(id);

    return NextResponse.json({
      message: 'User deleted successfully',
      deletedUser: {
        _id: user._id,
        name: user.name,
        employeeId: user.employeeId,
      },
      deletedAttendanceCount: attendanceDeleted.deletedCount ?? 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
