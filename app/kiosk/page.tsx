'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock3, ScanFace, XCircle } from 'lucide-react';
import BiometricFrame, { BiometricTone } from '@/components/BiometricFrame';
import type { FrameAnalysis } from '@/components/FaceScanner';
import { averageDescriptor } from '@/lib/biometric';

const FaceScanner = dynamic(() => import('@/components/FaceScanner'), { ssr: false });

type ScanState = 'passive' | 'analyzing' | 'matched' | 'failed';

interface IdentifiedUser {
  _id: string;
  name: string;
  role: string;
  employeeId: string;
}

const MATCH_SCORE_THRESHOLD = 65;
const REQUIRED_STABLE_FRAMES = 3;

export default function KioskPage() {
  const [scanState, setScanState] = useState<ScanState>('passive');
  const [mainMessage, setMainMessage] = useState('Silakan berdiri di depan kamera untuk absen.');
  const [identifiedUser, setIdentifiedUser] = useState<IdentifiedUser | null>(null);
  const [resultSubtitle, setResultSubtitle] = useState('');
  const [clockLabel, setClockLabel] = useState(() => new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }));

  const isProcessingRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);
  const stableDescriptorsRef = useRef<Float32Array[]>([]);

  const scheduleReset = useCallback((delayMs: number) => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setScanState('passive');
      setMainMessage('Silakan berdiri di depan kamera untuk absen.');
      setResultSubtitle('');
      setIdentifiedUser(null);
      stableDescriptorsRef.current = [];
      isProcessingRef.current = false;
      setClockLabel(new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }));
    }, delayMs);
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const triggerRecognition = useCallback(async (descriptor: Float32Array) => {
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;
    setScanState('analyzing');
    setMainMessage('Menganalisis wajah...');
    setResultSubtitle('Mohon tetap diam selama proses verifikasi.');

    try {
      const identifyResponse = await fetch('/api/user/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceDescriptor: Array.from(descriptor) }),
      });

      const identifyData = await identifyResponse.json();

      if (!identifyResponse.ok || !identifyData.user || (identifyData.score ?? 0) < MATCH_SCORE_THRESHOLD) {
        setScanState('failed');
        setMainMessage('Wajah tidak dikenali. Coba lagi.');
        setResultSubtitle('Pastikan wajah berada di dalam frame dan menghadap kamera.');
        scheduleReset(1200);
        return;
      }

      const user = identifyData.user as IdentifiedUser;
      const attendanceResponse = await fetch('/api/attendance/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, type: 'Check-in' }),
      });

      const attendanceData = await attendanceResponse.json();
      if (!attendanceResponse.ok) {
        setScanState('failed');
        setMainMessage(attendanceData.error ?? 'Gagal mencatat kehadiran.');
        setResultSubtitle('Silakan coba ulang.');
        scheduleReset(1200);
        return;
      }

      setIdentifiedUser(user);
      setScanState('matched');
      setMainMessage('Check-in Berhasil');
      setResultSubtitle(`${user.role} ${user.name}`);
      scheduleReset(3000);
    } catch {
      setScanState('failed');
      setMainMessage('Koneksi ke server terputus.');
      setResultSubtitle('Periksa jaringan lalu coba lagi.');
      scheduleReset(1500);
    }
  }, [scheduleReset]);

  const onFrameAnalysis = useCallback((analysis: FrameAnalysis) => {
    if (scanState === 'matched' || scanState === 'failed') return;

    if (!analysis.hasFace || !analysis.descriptor) {
      stableDescriptorsRef.current = [];
      if (!isProcessingRef.current) {
        setScanState('passive');
        setMainMessage('Silakan berdiri di depan kamera untuk absen.');
        setResultSubtitle('');
      }
      return;
    }

    const hasIssue = analysis.quality.issues.some((item) => item === 'outside-frame' || item === 'too-small' || item === 'too-large');
    if (hasIssue) {
      stableDescriptorsRef.current = [];
      if (!isProcessingRef.current) {
        setScanState('passive');
        setMainMessage('Posisikan wajah tepat di dalam frame.');
        setResultSubtitle('Lihat lurus ke kamera.');
      }
      return;
    }

    stableDescriptorsRef.current.push(new Float32Array(analysis.descriptor));
    if (stableDescriptorsRef.current.length > REQUIRED_STABLE_FRAMES) {
      stableDescriptorsRef.current.shift();
    }

    if (stableDescriptorsRef.current.length < REQUIRED_STABLE_FRAMES) {
      if (!isProcessingRef.current) {
        setScanState('analyzing');
        setMainMessage('Menstabilkan wajah...');
        setResultSubtitle('Tahan posisi sebentar.');
      }
      return;
    }

    const stabilizedDescriptor = averageDescriptor(stableDescriptorsRef.current);
    stableDescriptorsRef.current = [];
    void triggerRecognition(stabilizedDescriptor);
  }, [scanState, triggerRecognition]);

  const tone: BiometricTone = useMemo(() => {
    if (scanState === 'matched') return 'success';
    if (scanState === 'failed') return 'danger';
    if (scanState === 'analyzing') return 'active';
    return 'passive';
  }, [scanState]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#0f172a_0%,#020617_60%,#020617_100%)] text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white">
            <ArrowLeft className="h-5 w-5" suppressHydrationWarning />
          </Link>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Attendance Kiosk</p>
            <p className="text-xs text-slate-400">{clockLabel}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="relative overflow-hidden rounded-2xl">
            <FaceScanner onFrameAnalysis={onFrameAnalysis} active={scanState !== 'matched'} />
            <BiometricFrame
              tone={tone}
              message={mainMessage}
              showRadar={scanState === 'analyzing'}
              pulse={scanState === 'passive'}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <h1 className="mb-6 text-xl font-semibold text-slate-100">Status Verifikasi</h1>

          <div
            className={`rounded-2xl border p-5 transition ${
              scanState === 'matched'
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : scanState === 'failed'
                  ? 'border-rose-500/40 bg-rose-500/10'
                  : scanState === 'analyzing'
                    ? 'border-cyan-500/40 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-3">
              {scanState === 'matched' ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-400" suppressHydrationWarning />
              ) : scanState === 'failed' ? (
                <XCircle className="h-8 w-8 text-rose-400" suppressHydrationWarning />
              ) : scanState === 'analyzing' ? (
                <ScanFace className="h-8 w-8 text-cyan-300 animate-pulse" suppressHydrationWarning />
              ) : (
                <Clock3 className="h-8 w-8 text-slate-400" suppressHydrationWarning />
              )}
              <div>
                <p className="text-lg font-semibold">{mainMessage}</p>
                {resultSubtitle && <p className="text-sm text-slate-300">{resultSubtitle}</p>}
              </div>
            </div>
          </div>

          {identifiedUser && (
            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm uppercase tracking-wider text-emerald-300">Recognized Staff</p>
              <p className="mt-1 text-lg font-semibold text-emerald-100">{identifiedUser.name}</p>
              <p className="text-sm text-emerald-200/80">{identifiedUser.role} • {identifiedUser.employeeId}</p>
            </div>
          )}

          <div className="mt-6 text-sm text-slate-400">
            Sistem akan kembali ke mode scan otomatis setelah hasil ditampilkan.
          </div>
        </section>
      </main>
    </div>
  );
}
