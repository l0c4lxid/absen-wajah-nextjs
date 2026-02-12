import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  role: 'Surgeon' | 'Doctor' | 'Nurse' | 'Admin';
  employeeId: string;
  faceDescriptors: number[][];
  createdAt: Date;
}

const UserSchema: Schema<IUser> = new Schema({
  name: { type: String, required: true },
  role: {
    type: String,
    enum: ['Surgeon', 'Doctor', 'Nurse', 'Admin'],
    default: 'Doctor',
  },
  employeeId: { type: String, required: true, unique: true },
  faceDescriptors: { type: [[Number]], required: true },
  createdAt: { type: Date, default: Date.now },
});

// Prevent model overwrite upon hot reload
export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
