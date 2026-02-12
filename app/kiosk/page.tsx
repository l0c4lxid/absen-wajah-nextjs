
'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
const FaceScanner = dynamic(() => import('@/components/FaceScanner'), { ssr: false });
import { ArrowLeft, Clock, UserCheck, LogIn, LogOut, XCircle } from 'lucide-react';
import Link from 'next/link';

interface IdentifiedUser {
  _id: string;
  name: string;
  role: string;
  employeeId: string;
}

export default function KioskPage() {
  const [identifiedUser, setIdentifiedUser] = useState<IdentifiedUser | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [lastLog, setLastLog] = useState<{name: string, time: string, type: string} | null>(null);
  const [mainMessage, setMainMessage] = useState('Face Scanner Active');
  const isProcessing = useRef(false);
  const processingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Phase 1: Identify User
  const handleDetect = async (descriptor: Float32Array) => {
    if (isProcessing.current || identifiedUser) return; // Stop if processing or already identified
    
    isProcessing.current = true;
    setMainMessage('Identifying...');

    try {
      const response = await fetch('/api/user/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceDescriptor: Array.from(descriptor),
        }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
           setIdentifiedUser(data.user);
           setMatchScore(data.score || 0);
           setMainMessage(`Hello, ${data.user.name}`);
           isProcessing.current = false; // Allow interaction
           return;
      } else {
         setMainMessage('Face not recognized');
      }
    } catch (error) {
      console.error(error);
      setMainMessage('Error connecting to server');
    }

    // Retry if failed
    if (processingTimeout.current) clearTimeout(processingTimeout.current);
    processingTimeout.current = setTimeout(() => {
      isProcessing.current = false;
      if (!identifiedUser) setMainMessage('Face Scanner Active');
    }, 1500); 
  };

  // Phase 2: Manual Confirmation
  const handleAttendance = async (type: 'Check-in' | 'Check-out') => {
    if (!identifiedUser) return;

    setMainMessage(`Logging ${type}...`);

    try {
        const response = await fetch('/api/attendance/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: identifiedUser._id,
                type: type
            }),
        });

        const data = await response.json();

        if (response.ok) {
            const timestamp = new Date().toLocaleTimeString();
            setLastLog({
                name: identifiedUser.name,
                time: timestamp,
                type: type
            });
            setMainMessage(data.message);
            setIdentifiedUser(null); // Reset flow

            // Reset after success message
            setTimeout(() => {
                setLastLog(null);
                setMainMessage('Face Scanner Active');
                isProcessing.current = false;
            }, 4000);
        } else {
            setMainMessage(data.error || 'Error logging attendance');
            // Allow retry or cancel
            setTimeout(() => {
                 setMainMessage(`Hello, ${identifiedUser.name}`);
            }, 2000);
        }

    } catch (error) {
        setMainMessage('Network connection error');
    }
  };

  const cancelSelection = () => {
      setIdentifiedUser(null);
      setMatchScore(0);
      setMainMessage('Face Scanner Active');
      isProcessing.current = false;
  };

   const [currentTime, setCurrentTime] = useState<string>('');

   useEffect(() => {
     setCurrentTime(new Date().toLocaleDateString());
   }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
       {/* Top Bar */}
       <div className="w-full p-4 flex justify-between items-center z-20 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
            <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                <ArrowLeft className="w-5 h-5 text-white" suppressHydrationWarning />
            </Link>
            <div className="text-right">
                <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Surgical Dept.
                </h1>
                <p className="text-xs text-gray-400 flex items-center justify-end mt-0.5">
                    <Clock className="w-3 h-3 mr-1" suppressHydrationWarning />
                    {currentTime}
                </p>
            </div>
       </div>

       {/* Main Content: Split Layout */}
       <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
            
            {/* Left/Top: Camera Area */}
            <div className="flex-1 relative bg-black flex items-center justify-center p-4">
                 <div className={`
                    relative w-full max-w-lg aspect-[3/4] md:aspect-[4/3] rounded-2xl overflow-hidden border-2 shadow-2xl transition-all duration-500
                    ${lastLog ? 'border-green-500 shadow-green-500/20' : identifiedUser ? 'border-blue-500 shadow-blue-500/20' : 'border-gray-800'}
                `}>
                    <FaceScanner 
                        onDetect={handleDetect} 
                        className="w-full h-full"
                        width={640} 
                        height={480}
                        autoDetect={!identifiedUser} 
                    />
                    
                    {/* Success Overlay Only (kept on camera for immediate feedback) */}
                    {lastLog && (
                        <div className="absolute inset-0 bg-green-900/80 backdrop-blur-md z-40 flex flex-col items-center justify-center text-white animate-in zoom-in-95 duration-300">
                             <UserCheck className="w-16 h-16 mb-4" />
                             <h2 className="text-2xl font-bold mb-1">Success!</h2>
                             <p className="text-lg opacity-90">{lastLog.type} Confirmed</p>
                             <p className="mt-2 text-green-200 text-sm">{lastLog.time}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right/Bottom: Info & Controls Panel */}
            <div className={`
                flex-shrink-0 w-full md:w-96 bg-gray-900/80 border-t md:border-t-0 md:border-l border-gray-800 p-6 flex flex-col justify-center transition-all duration-300
                ${identifiedUser ? 'translate-y-0 opacity-100' : 'translate-y-0 opacity-100'} 
            `}>
                
                {identifiedUser ? (
                    <div className="flex flex-col items-center text-center animate-in slide-in-from-bottom duration-500">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-1 mb-4 shadow-xl">
                            <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center">
                                <span className="text-3xl font-bold text-white">{identifiedUser.name.charAt(0)}</span>
                            </div>
                        </div>
                        
                        <h2 className="text-2xl font-bold text-white mb-1">{identifiedUser.name}</h2>
                        <p className="text-gray-400 text-sm mb-4">{identifiedUser.role} • {identifiedUser.employeeId}</p>
                        
                        {/* Match Score Indicator */}
                        <div className="w-full bg-gray-800 rounded-full h-2.5 mb-1 overflow-hidden border border-gray-700">
                            <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${matchScore}%` }}></div>
                        </div>
                        <p className="text-xs text-blue-400 mb-6 font-mono">Match Confidence: {matchScore}%</p>

                        <div className="grid grid-cols-2 gap-3 w-full mb-4">
                            <button 
                                onClick={() => handleAttendance('Check-in')}
                                className="flex flex-col items-center justify-center p-3 bg-green-900/30 hover:bg-green-900/50 border border-green-700/50 rounded-xl transition-all group"
                            >
                                <LogIn className="w-6 h-6 text-green-500 mb-1 group-hover:scale-110 transition-transform" />
                                <span className="font-semibold text-green-400 text-sm">Masuk</span>
                            </button>
                            <button 
                                onClick={() => handleAttendance('Check-out')}
                                className="flex flex-col items-center justify-center p-3 bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 rounded-xl transition-all group"
                            >
                                <LogOut className="w-6 h-6 text-red-500 mb-1 group-hover:scale-110 transition-transform" />
                                <span className="font-semibold text-red-400 text-sm">Keluar</span>
                            </button>
                        </div>

                        <button 
                            onClick={cancelSelection}
                            className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm font-medium flex items-center justify-center"
                        >
                            <XCircle className="w-4 h-4 mr-2" />
                            Batal / Scan Ulang
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center opacity-50">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-4 animate-pulse">
                            <UserCheck className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-gray-300">Waiting for Scan...</h3>
                        <p className="text-sm text-gray-500 max-w-[200px]">
                            Position your face within the frame to log attendance.
                        </p>
                    </div>
                )}
            </div>
       </div>
    </div>
  );
}
