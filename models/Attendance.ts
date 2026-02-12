import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAttendance extends Document {
  user: mongoose.Types.ObjectId;
  date: Date;
  checkIn: Date;
  checkOut?: Date;
  status: 'Present' | 'Late' | 'Absent';
  method: 'FaceScan' | 'Manual' | 'Admin';
}

const AttendanceSchema: Schema<IAttendance> = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date },
  status: {
    type: String,
    enum: ['Present', 'Late', 'Absent'],
    default: 'Present',
  },
  method: {
    type: String,
    enum: ['FaceScan', 'Manual', 'Admin'],
    default: 'FaceScan',
  },
});

// Prevent model overwrite upon hot reload
export const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ||
  mongoose.model<IAttendance>('Attendance', AttendanceSchema);
