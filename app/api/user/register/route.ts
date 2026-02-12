
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/models/User';

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, role, employeeId, faceDescriptors } = body;

    // Basic validation
    if (!name || !employeeId || !faceDescriptors || !Array.isArray(faceDescriptors) || faceDescriptors.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields or invalid face descriptors' },
        { status: 400 }
      );
    }

    // Check if employee ID already exists
    const existingUser = await User.findOne({ employeeId });
    
    if (existingUser) {
        // Update existing user (Replace old data)
        existingUser.name = name;
        existingUser.role = role;
        existingUser.faceDescriptors = faceDescriptors;
        await existingUser.save();
        
        return NextResponse.json(
            { message: 'User updated successfully', user: existingUser },
            { status: 200 }
        );
    } else {
        // Create new user
        const newUser = await User.create({
            name,
            role,
            employeeId,
            faceDescriptors,
        });

        return NextResponse.json(
        { message: 'User registered successfully', user: newUser },
        { status: 201 }
        );
    }

  } catch (error: any) {
    console.error('Registration Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
