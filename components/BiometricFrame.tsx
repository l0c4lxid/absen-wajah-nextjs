import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { BIOMETRIC_FRAME } from '@/lib/biometric';

export type BiometricTone = 'neutral' | 'passive' | 'active' | 'warning' | 'danger' | 'success';

interface BiometricFrameProps {
  tone: BiometricTone;
  message: string;
  progress?: number;
  showScanBar?: boolean;
  showRadar?: boolean;
  pulse?: boolean;
  className?: string;
}

function toneStyles(tone: BiometricTone): string {
  if (tone === 'passive') return 'border-blue-300/70 shadow-[0_0_24px_rgba(96,165,250,0.35)]';
  if (tone === 'active') return 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.55)]';
  if (tone === 'warning') return 'border-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.55)]';
  if (tone === 'danger') return 'border-rose-500 shadow-[0_0_28px_rgba(244,63,94,0.55)]';
  if (tone === 'success') return 'border-emerald-400 shadow-[0_0_34px_rgba(16,185,129,0.7)]';
  return 'border-slate-400/80 shadow-[0_0_16px_rgba(148,163,184,0.35)]';
}

export default function BiometricFrame({
  tone,
  message,
  progress = 0,
  showScanBar = false,
  showRadar = false,
  pulse = false,
  className = '',
}: BiometricFrameProps) {
  return (
    <div className={`absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center ${className}`}>
      <div
        className={`relative border-[3px] transition-all duration-300 ${toneStyles(tone)} ${
          pulse ? 'animate-[framePulse_1.8s_ease-in-out_infinite]' : ''
        }`}
        style={{
          width: `${BIOMETRIC_FRAME.widthRatio * 100}%`,
          height: `${BIOMETRIC_FRAME.heightRatio * 100}%`,
          borderRadius: `${BIOMETRIC_FRAME.borderRadius}px`,
          boxShadow: `${tone === 'success' ? '0 0 34px rgba(16,185,129,0.75), ' : ''}0 0 0 9999px rgba(2,6,23,0.55)`,
        }}
      >
        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: `${BIOMETRIC_FRAME.borderRadius - 4}px` }}>
          {showScanBar && (
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-90 animate-[scanDown_1.8s_linear_infinite]" />
          )}
          {showRadar && (
            <div className="absolute -left-1/2 top-1/2 h-[180%] w-[180%] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent animate-[radarSweep_1.6s_linear_infinite]" />
          )}
        </div>

        {tone === 'success' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CheckCircle2 className="h-20 w-20 text-emerald-400 animate-[popIn_220ms_ease-out]" />
          </div>
        )}
        {tone === 'danger' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <AlertTriangle className="h-20 w-20 text-rose-400 animate-[popIn_160ms_ease-out]" />
          </div>
        )}
      </div>

      <div className="mt-6 w-[88%] max-w-lg rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-md">
        <p className="text-center text-sm font-medium tracking-wide text-slate-100">
          {tone === 'warning' && <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin text-amber-300" />}
          {message}
        </p>

        {progress > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-150 ${tone === 'success' ? 'bg-emerald-400' : 'bg-amber-400'}`}
              style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
