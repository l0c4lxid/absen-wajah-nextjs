
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const UserSchema = new mongoose.Schema({
  name: String,
  role: String,
  employeeId: String,
  faceDescriptor: [Number],
  createdAt: { type: Date, default: Date.now },
});

const AttendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: Date,
  checkIn: Date,
  checkOut: Date,
  status: String,
  method: String,
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const logs = await Attendance.find()
      .populate('user', 'name role employeeId')
      .sort({ checkIn: -1 })
      .limit(5);

    console.log('\n--- Latest 5 Attendance Logs ---');
    if (logs.length === 0) {
        console.log('No attendance records found.');
    } else {
        logs.forEach(log => {
            const userName = log.user ? log.user.name : 'Unknown User';
            const timeIn = log.checkIn ? new Date(log.checkIn).toLocaleTimeString() : '-';
            const timeOut = log.checkOut ? new Date(log.checkOut).toLocaleTimeString() : '-';
            console.log(`[${log.date.toLocaleDateString()}] ${userName} (${log.user?.role})`);
            console.log(`   In: ${timeIn} | Out: ${timeOut} | Status: ${log.status} | Method: ${log.method || 'N/A'}`);
            console.log('---');
        });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();
