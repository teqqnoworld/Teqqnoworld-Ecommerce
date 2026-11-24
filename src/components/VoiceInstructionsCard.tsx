import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Trash2,
  Upload,
  RotateCcw,
  Volume2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Languages,
} from 'lucide-react';

export interface VoiceInstructionsCardProps {
  voiceNoteUrl: string | null;
  onVoiceNoteChange: (url: string | null) => void;
  textNotes?: string;
  onTextNotesChange?: (notes: string) => void;
  title?: string;
  subtitle?: string;
  notesLabel?: string;
  notesPlaceholder?: string;
  hideTextArea?: boolean;
  defaultOpen?: boolean;
  compact?: boolean;
  className?: string;
}

const MAX_RECORDING_SECONDS = 60;
const MAX_AUDIO_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // ignore
    }
  }
  return '';
}

function formatSeconds(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const VoiceInstructionsCard: React.FC<VoiceInstructionsCardProps> = ({
  voiceNoteUrl,
  onVoiceNoteChange,
  textNotes = '',
  onTextNotesChange,
  title = 'Record Voice Instructions',
  subtitle,
  notesLabel = 'Or Type / Dictate Notes (Pantone codes, print placement, packaging):',
  notesPlaceholder = 'e.g. Use Pantone 286C thread for left chest embroidery. Pack each piece individually.',
  hideTextArea = false,
  defaultOpen = false,
  compact = false,
  className = '',
}) => {
  const notesInputId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen || Boolean(voiceNoteUrl));
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speechLang, setSpeechLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevels, setAudioLevels] = useState<number[]>([0.2, 0.35, 0.25, 0.4, 0.2]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestNotesRef = useRef(textNotes);
  latestNotesRef.current = textNotes;

  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const cleanupMediaResources = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setInterimTranscript('');
    setAudioLevels([0.2, 0.35, 0.25, 0.4, 0.2]);
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupMediaResources();
    };
  }, []);

  const stopVoiceRecording = () => {
    setIsRecording(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        cleanupMediaResources();
      }
    } else {
      cleanupMediaResources();
    }
  };

  const startVoiceRecording = async () => {
    setVoiceError(null);
    setInterimTranscript('');

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setVoiceError('Microphone requires a secure HTTPS connection. Please upload an audio file or type your instructions below.');
      return;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setVoiceError('Voice recording is not supported in this browser. You can upload an audio clip or type instructions below.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setVoiceError('Audio recording API is unavailable on this device. Please upload an audio note or type instructions below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      // Real-time audio waveform visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 32;
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteFrequencyData(dataArray);
            const bars = [1, 2, 3, 4, 5].map((idx) => {
              const raw = dataArray[idx] || 0;
              return Math.min(1, Math.max(0.18, raw / 190));
            });
            setAudioLevels(bars);
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {
        // Visualizer is progressive enhancement
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });

        if (audioBlob.size > 0) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = typeof reader.result === 'string' ? reader.result : null;
            if (result) {
              onVoiceNoteChange(result);
            } else {
              onVoiceNoteChange(URL.createObjectURL(audioBlob));
            }
          };
          reader.onerror = () => {
            onVoiceNoteChange(URL.createObjectURL(audioBlob));
          };
          reader.readAsDataURL(audioBlob);
        }

        cleanupMediaResources();
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      // Optional live speech-to-text transcription in parallel
      if (speechSupported && autoTranscribe && onTextNotesChange) {
        try {
          const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRec();
          recognition.lang = speechLang;
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onresult = (event: any) => {
            let finalText = '';
            let interimText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0]?.transcript || '';
              if (event.results[i].isFinal) {
                finalText += transcript;
              } else {
                interimText += transcript;
              }
            }
            setInterimTranscript(interimText.trim());
            if (finalText.trim()) {
              const existing = latestNotesRef.current.trim();
              const combined = existing ? `${existing} ${finalText.trim()}` : finalText.trim();
              latestNotesRef.current = combined;
              onTextNotesChange(combined);
            }
          };

          recognition.onerror = () => {
            // Do not fail voice recording if speech recognition is unavailable
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // Speech recognition optional
        }
      }

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            setTimeout(() => stopVoiceRecording(), 0);
            return MAX_RECORDING_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch (err: any) {
      cleanupMediaResources();
      setIsRecording(false);

      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        setVoiceError(
          'Microphone permission is blocked in your browser. Click the lock/camera icon in your address bar to Allow Microphone, then tap Retry Mic — or upload an audio clip / type notes below.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setVoiceError(
          'No microphone detected on this device. You can upload a pre-recorded voice note or type your instructions below.'
        );
      } else {
        setVoiceError(
          'Could not access microphone right now. Please tap Retry Mic, upload an audio file, or type your instructions below.'
        );
      }
    }
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setVoiceError(null);
    if (!file.type.startsWith('audio/')) {
      setVoiceError('Please choose a valid audio file (MP3, WAV, M4A, WebM, or OGG).');
      return;
    }
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      setVoiceError('Audio file is too large (max 10 MB). Please upload a shorter clip.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (result) {
        onVoiceNoteChange(result);
        setIsOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearVoiceNote = () => {
    if (isRecording) {
      stopVoiceRecording();
    }
    onVoiceNoteChange(null);
    setRecordingSeconds(0);
    setVoiceError(null);
  };

  return (
    <div className={className}>
      {/* Collapsible Header Pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={`w-full text-left bg-white hover:bg-zinc-50 border rounded-xl transition-all flex items-center justify-between shadow-2xs cursor-pointer ${
          compact ? 'p-3' : 'p-3.5'
        } ${
          voiceNoteUrl
            ? 'border-emerald-300 bg-emerald-50/30'
            : isRecording
              ? 'border-[#FF7900] bg-orange-50/40'
              : 'border-zinc-200'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`rounded-full flex items-center justify-center shrink-0 border transition-colors ${
              compact ? 'w-9 h-9' : 'w-10 h-10'
            } ${
              isRecording
                ? 'bg-[#FF7900] text-white border-[#FF7900] animate-pulse'
                : voiceNoteUrl
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-orange-50 text-[#FF7900] border-orange-200/70'
            }`}
          >
            {voiceNoteUrl ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#0B1530] flex flex-wrap items-center gap-1.5">
              <span>{title}</span>
              <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                Optional
              </span>
              {voiceNoteUrl && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Attached
                </span>
              )}
              {isRecording && (
                <span className="text-[10px] font-mono font-bold text-[#FF7900] bg-orange-100 px-1.5 py-0.5 rounded">
                  REC {formatSeconds(recordingSeconds)}
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-500 truncate mt-0.5">
              {subtitle ||
                (voiceNoteUrl
                  ? 'Voice note attached — listen or re-record anytime'
                  : 'Explain print placement, sizing or urgency in Hindi / English')}
            </div>
          </div>
        </div>

        <span className="text-zinc-400 shrink-0 ml-2">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {/* Expandable Voice Recorder & Notes Body */}
      {isOpen && (
        <div className="mt-2.5 p-3.5 sm:p-4 bg-[#FAF9FD] rounded-xl border border-zinc-200/90 space-y-3">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0B1530]">Voice Instructions:</span>
              {speechSupported && onTextNotesChange && !voiceNoteUrl && (
                <div className="inline-flex items-center gap-1 bg-white border border-zinc-200 rounded-lg px-2 py-0.5">
                  <Languages className="w-3 h-3 text-[#FF7900]" />
                  <button
                    type="button"
                    onClick={() => setAutoTranscribe((prev) => !prev)}
                    className={`text-[10px] font-semibold cursor-pointer ${
                      autoTranscribe ? 'text-[#0B1530]' : 'text-zinc-400 line-through'
                    }`}
                    title="Auto-convert spoken voice into written notes"
                  >
                    Voice-to-Text
                  </button>
                  {autoTranscribe && (
                    <button
                      type="button"
                      onClick={() => setSpeechLang((l) => (l === 'en-IN' ? 'hi-IN' : 'en-IN'))}
                      className="text-[10px] font-mono font-bold text-[#FF7900] bg-orange-50 px-1.5 py-0.2 rounded cursor-pointer hover:bg-orange-100"
                      title="Switch transcription language (English / Hindi)"
                    >
                      {speechLang === 'en-IN' ? 'EN' : 'HI'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {voiceNoteUrl && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleClearVoiceNote();
                    startVoiceRecording();
                  }}
                  className="text-[11px] font-semibold text-[#0B1530] hover:text-[#FF7900] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Re-record</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearVoiceNote}
                  className="text-[11px] font-semibold text-red-600 inline-flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Recorder Controls or Audio Player */}
          {!voiceNoteUrl ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {!isRecording ? (
                <>
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="bg-[#FF7900] hover:bg-[#e06a00] active:scale-[0.98] text-white text-xs font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Start Recording</span>
                  </button>

                  <label className="bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 text-[11px] font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-[#FF7900]" />
                    <span>Upload Audio</span>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                      aria-label="Upload audio voice instructions"
                      onChange={handleAudioFileUpload}
                      className="hidden"
                    />
                  </label>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3 w-full bg-white border border-orange-200 rounded-xl p-2.5">
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="bg-[#0B1530] hover:bg-black text-white text-xs font-semibold px-3.5 py-2 rounded-lg inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-[#FF7900]" />
                    <span>Stop &amp; Save ({formatSeconds(recordingSeconds)})</span>
                  </button>

                  {/* Live Level Waveform */}
                  <div className="flex items-center gap-1 h-6 px-1" aria-hidden="true">
                    {audioLevels.map((lvl, idx) => (
                      <span
                        key={idx}
                        className="w-1 bg-[#FF7900] rounded-full transition-all duration-100"
                        style={{ height: `${Math.round(lvl * 22)}px` }}
                      />
                    ))}
                  </div>

                  <span className="text-[11px] font-mono text-zinc-500 ml-auto">
                    {formatSeconds(recordingSeconds)} / {formatSeconds(MAX_RECORDING_SECONDS)}
                  </span>
                </div>
              )}

              {!isRecording && (
                <span className="text-[11px] text-zinc-500">Max 60s · Auto-saves with your request</span>
              )}
            </div>
          ) : (
            <div className="bg-white border border-emerald-200 rounded-xl p-2.5 space-y-1.5">
              <audio controls src={voiceNoteUrl} className="w-full h-9 rounded-lg" />
            </div>
          )}

          {/* Live Speech Preview */}
          {isRecording && interimTranscript && (
            <div className="text-[11px] text-[#0B1530] bg-white border border-orange-200/80 rounded-lg px-2.5 py-1.5 italic">
              Listening: &ldquo;{interimTranscript}&rdquo;
            </div>
          )}

          {/* Permission / Fallback Guidance */}
          {voiceError && (
            <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{voiceError}</span>
              </div>
              <button
                type="button"
                onClick={startVoiceRecording}
                className="shrink-0 bg-amber-900 hover:bg-black text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer self-start sm:self-center"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Mic</span>
              </button>
            </div>
          )}

          {/* Written / Auto-Transcribed Notes */}
          {!hideTextArea && onTextNotesChange && (
            <div className="pt-1">
              <label htmlFor={notesInputId} className="text-[11px] font-semibold text-zinc-700 block mb-1">
                {notesLabel}
              </label>
              <textarea
                id={notesInputId}
                value={textNotes}
                onChange={(e) => onTextNotesChange(e.target.value)}
                placeholder={notesPlaceholder}
                rows={compact ? 2 : 2}
                className="w-full p-2.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-800 focus:outline-none focus:border-[#FF7900]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
