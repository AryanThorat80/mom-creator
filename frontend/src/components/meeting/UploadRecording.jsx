import { useState, useRef } from 'react';
import { UploadCloud, FileAudio, FileVideo, X, Check } from 'lucide-react';
import { Button } from '../common/Button.jsx';

export function UploadRecording({ onUploadFile, disabled = false, loading = false }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const isVideo = selectedFile?.type?.startsWith('video/');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50/50'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,video/*"
            onChange={handleFileChange}
            disabled={disabled || loading}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-brand-gradient flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900">
            Click to upload or drag & drop
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Audio (MP3, WAV, M4A, AAC, WEBM) or Video (MP4, MOV, WEBM)
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                {isVideo ? <FileVideo className="w-5 h-5" /> : <FileAudio className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {formatFileSize(selectedFile.size)} · {selectedFile.type || 'Media file'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              disabled={disabled || loading}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors ml-2 cursor-pointer"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedFile(null)}
              disabled={disabled || loading}
            >
              Choose different file
            </Button>
            <Button
              size="sm"
              onClick={() => onUploadFile(selectedFile)}
              loading={loading}
              disabled={disabled}
              icon={UploadCloud}
            >
              Upload & Process
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
