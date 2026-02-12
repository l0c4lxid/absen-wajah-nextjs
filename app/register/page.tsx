'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Briefcase, Camera, CheckCircle2, Hash, Loader2, RefreshCw, Save, User, UserPlus } from 'lucide-react';
import BiometricFrame, { BiometricTone } from '@/components/BiometricFrame';
import { averageDescriptor, QualityIssue } from '@/lib/biometric';
import type { FrameAnalysis } from '@/components/FaceScanner';
import UserCrudPanel from '@/components/UserCrudPanel';

const FaceScanner = dynamic(() => import('@/components/FaceScanner'), { ssr: false });

type RegisterFlow = 'initializing' | 'waiting' | 'quality-error' | 'modeling' | 'finalized';
type AlertType = 'success' | 'error' | 'warning';

const REQUIRED_SAMPLES = 8;
const REQUIRED_DURATION_MS = 2200;
const SAMPLE_INTERVAL_MS = 280;

const ISSUE_MESSAGES: Record<QualityIssue, string> = {
  'no-face': 'Posisikan wajah Anda di dalam kotak.',
  'outside-frame': 'Wajah harus sepenuhnya berada di dalam kotak.',
  'too-dark': 'Terlalu gelap. Tambahkan pencahayaan.',
  'too-bright': 'Terlalu terang. Kurangi cahaya langsung.',
  'too-small': 'Wajah terlalu jauh. Dekatkan sedikit.',
  'too-large': 'Wajah terlalu dekat. Mundur sedikit.',
  'look-straight': 'Lihat lurus ke kamera.',
};

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    role: 'Doctor',
    employeeId: '',
  });

  const [flow, setFlow] = useState<RegisterFlow>('initializing');
  const [prompt, setPrompt] = useState('Menyiapkan kamera biometrik...');
  const [progress, setProgress] = useState(0);
  const [samplesCount, setSamplesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ text: string; type: AlertType } | null>(null);
  const [overwriteCandidate, setOverwriteCandidate] = useState<{ _id: string; name: string; role: string; employeeId: string } | null>(null);
  const [employeeCheck, setEmployeeCheck] = useState<{ exists: boolean; name?: string } | null>(null);
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

  const flowRef = useRef<RegisterFlow>('initializing');
  const sampleCollectionRef = useRef<Float32Array[]>([]);
  const averagedDescriptorRef = useRef<Float32Array | null>(null);
  const modelingStartedRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef(0);

  const setFlowSafe = useCallback((nextFlow: RegisterFlow, message: string, nextProgress: number) => {
    const changed = flowRef.current !== nextFlow || prompt !== message || progress !== nextProgress;
    if (!changed) return;

    flowRef.current = nextFlow;
    setFlow(nextFlow);
    setPrompt(message);
    setProgress(nextProgress);
  }, [progress, prompt]);

  const resetModeling = useCallback((message = 'Posisikan wajah Anda di dalam kotak.') => {
    sampleCollectionRef.current = [];
    averagedDescriptorRef.current = null;
    modelingStartedRef.current = null;
    lastSampleAtRef.current = 0;
    setSamplesCount(0);
    setFlowSafe('waiting', message, 0);
  }, [setFlowSafe]);

  const onFrameAnalysis = useCallback((analysis: FrameAnalysis) => {
    if (flowRef.current === 'initializing') {
      setFlowSafe('waiting', 'Posisikan wajah Anda di dalam kotak.', 0);
    }

    if (flowRef.current === 'finalized') {
      return;
    }

    if (!analysis.hasFace || !analysis.descriptor) {
      resetModeling('Posisikan wajah Anda di dalam kotak.');
      return;
    }

    const issue = analysis.quality.issues.find((item) => item !== 'no-face');
    if (issue) {
      sampleCollectionRef.current = [];
      averagedDescriptorRef.current = null;
      modelingStartedRef.current = null;
      lastSampleAtRef.current = 0;
      setSamplesCount(0);
      setFlowSafe('quality-error', ISSUE_MESSAGES[issue], 0);
      return;
    }

    const now = Date.now();
    if (!modelingStartedRef.current) {
      modelingStartedRef.current = now;
      setFlowSafe('modeling', 'Tahan posisi, sedang memproses...', 5);
    }

    if (now - lastSampleAtRef.current < SAMPLE_INTERVAL_MS) {
      return;
    }

    lastSampleAtRef.current = now;
    sampleCollectionRef.current.push(new Float32Array(analysis.descriptor));
    setSamplesCount(sampleCollectionRef.current.length);

    const elapsed = now - (modelingStartedRef.current ?? now);
    const sampleProgress = Math.min(1, sampleCollectionRef.current.length / REQUIRED_SAMPLES);
    const durationProgress = Math.min(1, elapsed / REQUIRED_DURATION_MS);
    const unifiedProgress = Math.round(Math.min(sampleProgress, durationProgress) * 100);

    setProgress(unifiedProgress);

    if (sampleCollectionRef.current.length >= REQUIRED_SAMPLES && elapsed >= REQUIRED_DURATION_MS) {
      const averaged = averageDescriptor(sampleCollectionRef.current);
      averagedDescriptorRef.current = averaged;
      setFlowSafe('finalized', 'Wajah berhasil didaftarkan!', 100);
      setAlert({ text: 'Model wajah siap disimpan. Lengkapi data lalu klik Register Staff.', type: 'success' });
    }
  }, [resetModeling, setFlowSafe]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (flow !== 'finalized' || !averagedDescriptorRef.current) {
      setAlert({ text: 'Selesaikan proses modeling wajah terlebih dahulu.', type: 'error' });
      return;
    }

    setLoading(true);
    setAlert(null);

    try {
      const averaged = averagedDescriptorRef.current;
      const sampled = sampleCollectionRef.current.map((descriptor) => Array.from(descriptor));
      const faceDescriptors = [Array.from(averaged), ...sampled];

      const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          faceDescriptors,
          confirmOverwrite: Boolean(overwriteCandidate),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data.code === 'EMPLOYEE_EXISTS' && data.existingUser) {
          setOverwriteCandidate(data.existingUser);
          setAlert({
            text: `Employee ID sudah terdaftar atas nama ${data.existingUser.name}. Klik Register lagi untuk overwrite.`,
            type: 'warning',
          });
          return;
        }
        if (response.status === 409 && data.code === 'FACE_ALREADY_REGISTERED' && data.conflictUser) {
          setAlert({
            text: `Wajah mirip dengan user ${data.conflictUser.name} (${data.conflictUser.employeeId}) skor ${data.score}%. Batalkan untuk mencegah salah user.`,
            type: 'error',
          });
          setOverwriteCandidate(null);
          return;
        }
        setAlert({ text: data.error ?? 'Registrasi gagal.', type: 'error' });
        return;
      }

      setAlert({ text: 'Wajah berhasil didaftarkan dan tersimpan di database.', type: 'success' });
      setOverwriteCandidate(null);
      setFormData({ name: '', role: 'Doctor', employeeId: '' });
      setEmployeeCheck(null);
      resetModeling('Posisikan wajah Anda di dalam kotak.');
      flowRef.current = 'initializing';
      setFlow('initializing');
      setPrompt('Menyiapkan kamera biometrik...');
      setProgress(0);
      setUsersRefreshKey((prev) => prev + 1);
    } catch {
      setAlert({ text: 'Terjadi masalah jaringan saat menyimpan.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [flow, formData, overwriteCandidate, resetModeling]);

  const validateEmployeeId = useCallback(async (employeeId: string) => {
    const normalized = employeeId.trim().toUpperCase();
    if (!normalized) {
      setEmployeeCheck(null);
      return;
    }

    try {
      const response = await fetch('/api/user/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: normalized }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEmployeeCheck(null);
        return;
      }

      setEmployeeCheck(
        data.employeeExists && data.employee
          ? { exists: true, name: data.employee.name }
          : { exists: false }
      );
    } catch {
      setEmployeeCheck(null);
    }
  }, []);

  const frameTone: BiometricTone = useMemo(() => {
    if (flow === 'finalized') return 'success';
    if (flow === 'modeling') return 'warning';
    if (flow === 'quality-error') return 'danger';
    if (flow === 'initializing') return 'neutral';
    return 'neutral';
  }, [flow]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,#e2e8f0_0%,#f8fafc_45%,#e2e8f0_100%)] pb-10">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
              <ArrowLeft className="h-5 w-5" suppressHydrationWarning />
            </Link>
            <h1 className="flex items-center text-lg font-semibold text-slate-900">
              <UserPlus className="mr-2 h-5 w-5 text-cyan-600" suppressHydrationWarning />
              Face Registration
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-300/30">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center text-sm font-semibold uppercase tracking-wider text-slate-600">
                <Camera className="mr-2 h-4 w-4 text-slate-500" suppressHydrationWarning />
                Modeling Camera
              </h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Sampel {samplesCount}/{REQUIRED_SAMPLES}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-2xl">
              <FaceScanner onFrameAnalysis={onFrameAnalysis} active={flow !== 'finalized'} />
              <BiometricFrame
                tone={frameTone}
                message={prompt}
                progress={flow === 'modeling' || flow === 'finalized' ? progress : 0}
                showScanBar={flow === 'modeling'}
                pulse={flow === 'waiting' || flow === 'initializing'}
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
              <p>Pastikan wajah menghadap kamera dan tidak keluar kotak.</p>
              <button
                type="button"
                onClick={() => resetModeling()}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" suppressHydrationWarning />
                Reset Modeling
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/30">
          <h2 className="mb-5 text-xl font-semibold text-slate-900">Data Staff</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nama Lengkap</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" suppressHydrationWarning />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  placeholder="Dr. Aditya Ramadhan"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" suppressHydrationWarning />
                <select
                  value={formData.role}
                  onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="Surgeon">Surgeon</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Nurse">Nurse</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Employee ID</label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" suppressHydrationWarning />
                <input
                  type="text"
                  required
                  value={formData.employeeId}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, employeeId: e.target.value }));
                    setOverwriteCandidate(null);
                  }}
                  onBlur={(e) => {
                    void validateEmployeeId(e.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  placeholder="EMP-0042"
                />
              </div>
              {employeeCheck?.exists && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Employee ID ini sudah terdaftar atas nama <strong>{employeeCheck.name}</strong>. Submit akan membutuhkan konfirmasi overwrite.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || flow !== 'finalized'}
              className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
                loading || flow !== 'finalized'
                  ? 'cursor-not-allowed bg-slate-300'
                  : 'bg-cyan-600 shadow-lg shadow-cyan-600/25 hover:bg-cyan-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" suppressHydrationWarning />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" suppressHydrationWarning />
                  Register Staff
                </>
              )}
            </button>
            {overwriteCandidate && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" suppressHydrationWarning />
                  <p>
                    Mode overwrite aktif untuk <strong>{overwriteCandidate.name}</strong> ({overwriteCandidate.employeeId}). Klik Register Staff sekali lagi untuk lanjut.
                  </p>
                </div>
              </div>
            )}
          </form>

          {alert && (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${
                alert.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : alert.type === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              <div className="flex items-start gap-2">
                {alert.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4" suppressHydrationWarning />}
                <p>{alert.text}</p>
              </div>
            </div>
          )}
        </section>
      </main>

      <div className="mx-auto mt-2 max-w-6xl px-4 pb-8">
        <UserCrudPanel refreshKey={usersRefreshKey} />
      </div>
    </div>
  );
}
