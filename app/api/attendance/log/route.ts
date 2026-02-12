
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { User, IUser } from '@/models/User';
import { Attendance } from '@/models/Attendance';

// Euclidean distance threshold for face matching
// 0.6 is a common threshold for dlib/face-api
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
    const { faceDescriptor, userId, type } = await req.json();

    let user: IUser | null = null;

    // SCENARIO 1: Manual Confirmation (userId provided)
    if (userId) {
        user = await User.findById(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
    } 
    // SCENARIO 2: Automatic Face Recognition (faceDescriptor provided)
    else if (faceDescriptor && Array.isArray(faceDescriptor)) {
        // ... (Existing face matching logic) ...
        const users = await User.find({});
        let bestMatchUser: IUser | null = null;
        let minDistance = 1.0;

        for (const u of users) {
          if (!u.faceDescriptors || u.faceDescriptors.length === 0) {
            continue;
          }

          let userMinDistance = 1.0;
          for (const storedDescriptor of u.faceDescriptors) {
            const distance = getEuclideanDistance(faceDescriptor, storedDescriptor);
            if (distance < userMinDistance) {
              userMinDistance = distance;
            }
          }

          if (userMinDistance < minDistance) {
            minDistance = userMinDistance;
            bestMatchUser = u;
          }
        }

        if (!bestMatchUser || minDistance > MATCH_THRESHOLD) {
          return NextResponse.json({ error: 'Face not recognized' }, { status: 404 });
        }
        user = bestMatchUser;
    } else {
        return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // 2. Log Attendance based on Type or Auto-detect
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let attendance = await Attendance.findOne({
      user: user._id,
      date: { $gte: todayStart, $lte: todayEnd }
    });

    let message = '';
    let actionType = '';

    // If type is explicitly provided (Manual Confirmation)
    if (type === 'Check-in') {
        if (!attendance) {
            attendance = await Attendance.create({
                user: user._id,
                date: new Date(),
                checkIn: new Date(),
                status: 'Present',
                method: 'Manual'
            });
            message = `Welcome, ${user.role} ${user.name}. Checked in at ${attendance.checkIn.toLocaleTimeString()}`;
            actionType = 'Check-in';
        } else {
            return NextResponse.json({ message: `You have already checked in today.` }, { status: 200 });
        }
    } else if (type === 'Check-out') {
        if (attendance && !attendance.checkOut) {
            attendance.checkOut = new Date();
            await attendance.save();
            message = `Goodbye, ${user.name}. Checked out at ${attendance.checkOut.toLocaleTimeString()}`;
            actionType = 'Check-out';
        } else if (!attendance) {
             return NextResponse.json({ error: `You haven't checked in yet today.` }, { status: 400 });
        } else {
             return NextResponse.json({ message: `You have already checked out today.` }, { status: 200 });
        }
    } 
    // Fallback: Automatic toggle (if no type provided - legacy support)
    else {
        if (!attendance) {
            attendance = await Attendance.create({
                user: user._id,
                date: new Date(),
                checkIn: new Date(),
                status: 'Present',
                method: 'FaceScan'
            });
            message = `Welcome, ${user.role} ${user.name}. Checked in at ${attendance.checkIn.toLocaleTimeString()}`;
            actionType = 'Check-in';
        } else if (!attendance.checkOut) {
            attendance.checkOut = new Date();
            await attendance.save();
            message = `Goodbye, ${user.name}. Checked out at ${attendance.checkOut.toLocaleTimeString()}`;
            actionType = 'Check-out';
        } else {
            return NextResponse.json({ message: `You have already checked out for today.` }, { status: 200 });
        }
    }

    return NextResponse.json({
      message,
      user: user.name,
      type: actionType
    });

  } catch (error: unknown) {
    console.error('Attendance Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
