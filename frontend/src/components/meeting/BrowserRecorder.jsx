import { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, Upload, AlertCircle, Volume2 } from 'lucide-react';
import { Button } from '../common/Button.jsx';

export function BrowserRecorder({ onRecordingComplete, disabled = false }) {
  const [recordingState, setRecordingState] = useState('idle'); // idle | recording | stopped
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [detectedExt, setDetectedExt] = useState('webm');
  const [permissionError, setPermissionError] = useState('');

  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setPermissionError('');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = '';
      let ext = 'webm';

      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
        ext = 'webm';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
        ext = 'webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        ext = 'mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
        ext = 'ogg';
      }

      setDetectedExt(ext);

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = mimeType || mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecordingState('stopped');

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(500);
      setRecordingState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access failed:', err);
      setPermissionError(
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser settings.'
          : 'Could not access audio recording device.'
      );
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setRecordingState('idle');
    setPermissionError('');
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      {permissionError && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <p>{permissionError}</p>
        </div>
      )}

      {recordingState === 'idle' && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <Mic className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900">Microphone Ready</h4>
          <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
            Record in-room or device audio. When finished, you can review and upload for AI transcription.
          </p>
          <Button
            onClick={startRecording}
            disabled={disabled}
            icon={Mic}
          >
            Start Recording
          </Button>
        </div>
      )}

      {recordingState === 'recording' && (
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
          <div className="flex items-center gap-2 text-rose-600">
            <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider">Recording in progress</span>
          </div>
          <div className="text-3xl font-mono font-bold tracking-tight text-slate-900 tabular-nums">
            {formatTime(duration)}
          </div>
          <p className="text-xs text-slate-500">Speak clearly near your microphone.</p>
          <Button
            variant="danger"
            onClick={stopRecording}
            icon={Square}
          >
            Stop Recording
          </Button>
        </div>
      )}

      {recordingState === 'stopped' && audioBlob && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Audio Captured</p>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {formatTime(duration)} · {formatFileSize(audioBlob.size)} ({detectedExt.toUpperCase()})
                </p>
              </div>
            </div>
            {audioUrl && (
              <audio controls src={audioUrl} className="h-8 max-w-xs" />
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={resetRecording}
              icon={RotateCcw}
              disabled={disabled}
            >
              Re-record
            </Button>
            <Button
              size="sm"
              onClick={() => onRecordingComplete(audioBlob, `mic_recording_${Date.now()}.${detectedExt}`)}
              icon={Upload}
              disabled={disabled}
            >
              Upload & Process
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
