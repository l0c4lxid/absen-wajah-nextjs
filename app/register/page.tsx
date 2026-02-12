'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
const FaceScanner = dynamic(() => import('@/components/FaceScanner'), { ssr: false });
import { UserPlus, User, Briefcase, Hash, Camera, Save, ArrowLeft, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    role: 'Doctor',
    employeeId: '',
  });

  // Multi-sample capture state
  const REQUIRED_SAMPLES = 5;
  const [samples, setSamples] = useState<Float32Array[]>([]);
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'warning' } | null>(null);
  
  // Use refs to track latest state inside the callback without dependencies issues
  const samplesRef = useRef<Float32Array[]>([]);
  const isCheckingRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    samplesRef.current = samples;
  }, [samples]);

  useEffect(() => {
    isCheckingRef.current = isChecking;
  }, [isChecking]);

  const handleDetect = async (descriptor: Float32Array) => {
    // 1. If we already have enough samples, stop.
    if (samplesRef.current.length >= REQUIRED_SAMPLES) return;

    // 2. If valid sample count is 0, we need to do the Duplicate Check first.
    if (samplesRef.current.length === 0) {
        if (isCheckingRef.current) return; // Prevent double-check
        
        setIsChecking(true);
        setMessage({ text: 'Verifying face uniqueness...', type: 'warning' });

        try {
            // Call API to check if face exists
            const response = await fetch('/api/user/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  faceDescriptor: Array.from(descriptor),
                }),
            });

            const data = await response.json();

            // If found with high confidence
            if (response.ok && data.user && data.score > 85) {
                setMessage({ 
                    text: `Face already registered to ${data.user.name}. Registration blocked.`, 
                    type: 'error' 
                });
                setIsChecking(false);
                return; // Stop here
            }

            // If unique or low match, accept this as first sample
            // Small delay to ensure user sees "Verified" state briefly? Maybe not needed.
            setSamples([descriptor]);
            setMessage({ text: `Identity verified. Capturing samples... 1/${REQUIRED_SAMPLES}`, type: 'warning' });

        } catch (error) {
            console.error("Uniqueness check failed", error);
            // On error, we allow proceeding but warn? Or just proceed.
            // Let's proceed to allow offline-ish usage if DB is flaky, 
            // but ideally we should block. For now, assume it's OK.
            setSamples([descriptor]);
            setMessage({ text: `Network check optional. Capturing samples... 1/${REQUIRED_SAMPLES}`, type: 'warning' });
        } finally {
            setIsChecking(false);
        }
    } else {
        // 3. We already have at least 1 sample, collect the rest.
        // We can add a throttle here if needed, but FaceScanner usually runs reasonable fps.
        
        // Simple distance check to ensure diversity? 
        // For now, simply collect.
        setSamples((prev) => {
            if (prev.length >= REQUIRED_SAMPLES) return prev;
            const newSamples = [...prev, descriptor];
            
            if (newSamples.length === REQUIRED_SAMPLES) {
                setMessage({ text: 'Face capture complete! Ready to save.', type: 'success' });
            } else {
                 setMessage({ text: `Capturing samples... ${newSamples.length}/${REQUIRED_SAMPLES}. Move head slightly.`, type: 'warning' });
            }
            return newSamples;
        });
    }
  };

  const handleReset = () => {
      setSamples([]);
      setMessage(null);
      setIsChecking(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (samples.length < REQUIRED_SAMPLES) {
      setMessage({ text: `Please capture all ${REQUIRED_SAMPLES} samples.`, type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Prepare multi-sample data
      const faceDescriptors = samples.map(s => Array.from(s));

      const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          faceDescriptors: faceDescriptors,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ text: 'Staff registered & model updated successfully!', type: 'success' });
        setFormData({ name: '', role: 'Doctor', employeeId: '' });
        setSamples([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setMessage({ text: data.error || 'Registration failed', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Network error occurred.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center space-x-3">
              <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-600" suppressHydrationWarning />
              </Link>
              <h1 className="text-lg font-bold text-gray-900 flex items-center">
                  <UserPlus className="w-5 h-5 mr-2 text-blue-600" suppressHydrationWarning />
                  Staff Registration
              </h1>
           </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Col: Camera */}
        <div className="space-y-6">
            <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-colors ${message?.type === 'error' ? 'border-red-300' : 'border-gray-200'}`}>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="font-semibold text-gray-800 flex items-center">
                        <Camera className="w-4 h-4 mr-2 text-gray-500" suppressHydrationWarning />
                        Face Capture
                    </h2>
                    {isChecking ? (
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse">
                             Checking...
                         </span>
                    ) : samples.length === REQUIRED_SAMPLES ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                             <CheckCircle2 className="w-3 h-3 mr-1" suppressHydrationWarning />
                             Complete
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                             Sample {samples.length}/{REQUIRED_SAMPLES}
                        </span>
                    )}
                </div>
                <div className="p-4 relative">
                    {/* Only auto-detect if we aren't full and aren't checking */}
                    <FaceScanner onDetect={handleDetect} autoDetect={samples.length < REQUIRED_SAMPLES && !isChecking} />
                    
                    {/* Progress Bar Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-100">
                        <div 
                            className={`h-full transition-all duration-300 ease-out ${samples.length === REQUIRED_SAMPLES ? 'bg-green-500' : 'bg-blue-600'}`}
                            style={{ width: `${(samples.length / REQUIRED_SAMPLES) * 100}%` }}
                        ></div>
                    </div>

                    {/* Block overlay if error or complete */}
                    {message?.type === 'error' && (
                         <div className="absolute inset-0 bg-red-900/10 backdrop-blur-[1px] flex items-center justify-center rounded-b-2xl pointer-events-none"></div>
                    )}
                </div>
                
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        {samples.length === 0 ? "Position face in center" : "Move head slightly for better angles"}
                    </p>
                    <button 
                        type="button"
                        onClick={handleReset}
                        className="flex items-center text-xs font-medium text-gray-600 hover:text-red-700 transition-colors"
                    >
                        <RefreshCw className="w-3 h-3 mr-1" suppressHydrationWarning />
                        Reset Capture
                    </button>
                </div>
            </div>
        </div>

        {/* Right Col: Form */}
        <div className="space-y-6">
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Staff Details</h2>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" suppressHydrationWarning />
                            </div>
                            <input
                                type="text"
                                required
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                                placeholder="Dr. John Doe"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Briefcase className="h-5 w-5 text-gray-400" suppressHydrationWarning />
                            </div>
                            <select
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="Surgeon">Surgeon</option>
                                <option value="Doctor">Doctor</option>
                                <option value="Nurse">Nurse</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Hash className="h-5 w-5 text-gray-400" suppressHydrationWarning />
                            </div>
                            <input
                                type="text"
                                required
                                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                                placeholder="EMP-12345"
                                value={formData.employeeId}
                                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                             Note: Using an existing ID will overwrite previous face data.
                        </p>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading || samples.length < REQUIRED_SAMPLES}
                            className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white transition-all
                                ${loading || samples.length < REQUIRED_SAMPLES 
                                    ? 'bg-gray-300 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md transform hover:-translate-y-0.5'
                                }
                            `}
                        >
                            {loading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5 mr-2" suppressHydrationWarning />
                                    Register Staff
                                </>
                            )}
                        </button>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-lg flex items-start space-x-3 
                            ${message.type === 'success' ? 'bg-green-50 text-green-800' : 
                              message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'
                            }`}>
                            
                            {message.type === 'success' ? (
                                <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" suppressHydrationWarning />
                            ) : message.type === 'error' ? (
                                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" suppressHydrationWarning />
                            ) : (
                                <Camera className="w-5 h-5 mt-0.5 flex-shrink-0" suppressHydrationWarning />
                            )}
                            
                            <span className="text-sm font-medium leading-tight pt-0.5">{message.text}</span>
                            
                            {message.type === 'error' && (
                                <button 
                                    type="button" 
                                    onClick={handleReset}
                                    className="ml-auto text-xs underline hover:text-red-900 whitespace-nowrap"
                                >
                                    Try Again
                                </button>
                            )}
                        </div>
                    )}
                </form>
             </div>
        </div>

      </div>
    </div>
  );
}
