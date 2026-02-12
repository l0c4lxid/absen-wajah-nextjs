
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/models/User';
import { Attendance } from '@/models/Attendance';

export async function POST(req: Request) {
  try {
    await dbConnect();
    
    // Delete all users
    const deleteUsers = await User.deleteMany({});
    
    // Delete all attendance records
    const deleteAttendance = await Attendance.deleteMany({});

    return NextResponse.json({
      message: 'Database cleared successfully',
      usersDeleted: deleteUsers.deletedCount,
      attendanceDeleted: deleteAttendance.deletedCount
    }, { status: 200 });

  } catch (error: any) {
    console.error('Reset DB Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
