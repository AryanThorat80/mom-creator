import { useState, useRef } from 'react';
import { Paperclip, Plus, FileText, FileSpreadsheet, File, Trash2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { uploadToStorage, confirmAttachmentUpload } from '../../services/attachments.js';
import { useToast } from '../../context/ToastContext.jsx';

export function AttachmentsList({
  meetingId,
  workspaceId,
  attachments = [],
  onAttachmentUploaded,
}) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    setUploading(true);
    try {
      // 1. Upload to Supabase Storage 'meeting-files' bucket
      const uploaded = await uploadToStorage({
        file,
        bucket: 'meeting-files',
        workspaceId,
        meetingId,
      });

      // 2. Confirm upload with FastAPI backend
      const confirmed = await confirmAttachmentUpload({
        meeting_id: meetingId,
        bucket: 'meeting-files',
        path: uploaded.path,
        file_name: uploaded.fileName,
        file_type: uploaded.fileType,
        file_size: uploaded.fileSize,
        attachment_type: 'meeting_attachment',
      });

      showToast('Attachment uploaded and confirmed', 'success');
      if (onAttachmentUploaded) {
        onAttachmentUploaded(confirmed.attachment || uploaded);
      }
    } catch (err) {
      console.error('Attachment upload failed:', err);
      showToast(err.message || 'Failed to upload attachment', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileName = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'csv' || ext === 'xls') return FileSpreadsheet;
    if (ext === 'pdf' || ext === 'docx' || ext === 'doc' || ext === 'txt') return FileText;
    return File;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-slate-500" />
            <span>Supporting Attachments ({attachments.length})</span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Reference notes, past MOMs, and project documents.
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            icon={Plus}
          >
            Add File
          </Button>
        </div>
      </div>

      {attachments.length === 0 ? (
        <div className="text-center py-5 text-xs text-slate-400 italic">
          No supporting attachments added to this meeting.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {attachments.map((att, idx) => {
            const Icon = getFileIcon(att.file_name);
            return (
              <div key={att.id || idx} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {att.file_name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono tabular-nums">
                      {formatFileSize(att.file_size)} · {att.attachment_type || 'Attachment'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
