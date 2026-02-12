
import Link from 'next/link';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { Camera, UserPlus, Database, Activity, ScanFace } from 'lucide-react';

async function getDbStatus() {
  try {
    await dbConnect();
    return mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  } catch (e) {
    return 'Error';
  }
}

export default async function Home() {
  const dbStatus = await getDbStatus();
  const isOnline = dbStatus === 'Connected';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        
        <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-6 shadow-lg shadow-blue-600/20 transform rotate-3">
                <ScanFace className="w-8 h-8" suppressHydrationWarning />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                Hospital Attendance
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Secure, touch-free facial recognition system for high-priority medical environments.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
          {/* Card 1 */}
          <Link href="/kiosk" className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-blue-500/30">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <Camera className="w-32 h-32 -mr-8 -mt-8 text-blue-600" suppressHydrationWarning />
             </div>
             
             <div className="relative z-10">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Camera className="w-6 h-6" suppressHydrationWarning />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Kiosk Mode</h2>
                <p className="text-gray-500 mb-6">Launch the facial recognition scanner for staff check-ins.</p>
                <div className="inline-flex items-center text-blue-600 font-semibold group-hover:translate-x-1 transition-transform">
                    Launch Scanner →
                </div>
             </div>
          </Link>

          {/* Card 2 */}
          <Link href="/register" className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-violet-500/30">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <UserPlus className="w-32 h-32 -mr-8 -mt-8 text-violet-600" suppressHydrationWarning />
             </div>
             
             <div className="relative z-10">
                <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600 mb-6 group-hover:scale-110 transition-transform duration-300">
                    <UserPlus className="w-6 h-6" suppressHydrationWarning />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration</h2>
                <p className="text-gray-500 mb-6">Enroll new medical staff into the biometric database.</p>
                <div className="inline-flex items-center text-violet-600 font-semibold group-hover:translate-x-1 transition-transform">
                    Add Staff →
                </div>
             </div>
          </Link>
        </div>

        {/* Footer Status */}
        <div className="flex justify-center">
            <div className={`px-5 py-2 rounded-full border flex items-center space-x-2 text-sm font-medium
                ${isOnline ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}
            `}>
                <Database className="w-4 h-4" suppressHydrationWarning />
                <span>System Status:</span>
                <span className="flex items-center">
                    {isOnline ? 'Online' : 'Offline'}
                    <span className={`relative flex h-2.5 w-2.5 ml-2`}>
                      {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </span>
                </span>
            </div>
        </div>
        
      </div>
    </div>
  );
}
