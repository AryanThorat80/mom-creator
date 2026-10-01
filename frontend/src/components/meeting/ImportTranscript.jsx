import { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  AlertCircle,
  FileCode,
  X,
} from 'lucide-react';

import { Button } from '../common/Button.jsx';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.srt',
  '.vtt',
  '.json',
];

export function ImportTranscript({
  onImportTranscript,
  loading = false,
  disabled = false,
}) {
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    setError('');

    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    const extension = `.${file.name
      .split('.')
      .pop()
      ?.toLowerCase()}`;

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      setError(
        `Unsupported file type. Supported formats: ${SUPPORTED_EXTENSIONS.join(
          ', '
        )}`
      );

      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be smaller than 10MB.');

      e.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleStartImport = () => {
    setError('');

    if (activeTab === 'upload') {
      if (!selectedFile) {
        setError(
          'Please select a transcript file to import.'
        );
        return;
      }

      onImportTranscript({
        file: selectedFile,
        text: null,
      });

      return;
    }

    const text = pastedText.trim();

    if (!text) {
      setError(
        'Please paste the transcript or meeting notes.'
      );
      return;
    }

    const textFile = new File(
      [text],
      `imported_transcript_${Date.now()}.txt`,
      {
        type: 'text/plain',
      }
    );

    onImportTranscript({
      file: textFile,
      text,
    });
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />

            <span>
              Import Transcript or Meeting Notes
            </span>
          </h4>

          <p className="text-[11px] text-slate-500 mt-0.5">
            Upload an existing transcript or paste your
            meeting notes.
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              setError('');
            }}
            disabled={disabled || loading}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'upload'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Upload
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('paste');
              setError('');
            }}
            disabled={disabled || loading}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'paste'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Paste
          </button>
        </div>
      </div>

      {/* Upload */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.srt,.vtt,.json,text/plain,application/json"
            onChange={handleFileChange}
            disabled={disabled || loading}
            className="hidden"
          />

          {!selectedFile ? (
            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={disabled || loading}
              className="w-full flex flex-col items-center justify-center p-7 rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 bg-slate-50/50 cursor-pointer text-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-brand-gradient flex items-center justify-center mb-2">
                <Upload className="w-5 h-5" />
              </div>

              <p className="text-xs font-semibold text-slate-800">
                Upload existing transcript
              </p>

              <p className="text-[11px] text-slate-500 mt-1">
                Click to browse or select a file
              </p>

              <p className="text-[10px] text-slate-400 mt-2">
                TXT • MD • SRT • VTT • JSON • Max 10MB
              </p>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                  <FileCode className="w-4 h-4 text-brand-gradient" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">
                    {selectedFile.name}
                  </p>

                  <p className="text-[10px] text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={clearSelectedFile}
                disabled={loading}
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Paste */}
      {activeTab === 'paste' && (
        <div className="space-y-2">
          <textarea
            rows={7}
            placeholder={
              'Paste your transcript, meeting summary, or notes here...'
            }
            value={pastedText}
            onChange={(e) => {
              setPastedText(e.target.value);

              if (error) {
                setError('');
              }
            }}
            disabled={disabled || loading}
            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-brand-gradient font-mono resize-y"
          />

          <p className="text-[10px] text-slate-400">
            The text will be processed as the meeting
            transcript/input for MOM generation.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Action */}
      <div className="flex items-center justify-end pt-2">
        <Button
          type="button"
          size="sm"
          onClick={handleStartImport}
          loading={loading}
          disabled={
            disabled ||
            loading ||
            (activeTab === 'upload' &&
              !selectedFile) ||
            (activeTab === 'paste' &&
              !pastedText.trim())
          }
          icon={Sparkles}
        >
          Generate MOM
        </Button>
      </div>
    </div>
  );
}