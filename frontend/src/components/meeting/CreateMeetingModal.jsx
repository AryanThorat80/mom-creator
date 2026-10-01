import { useState } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Textarea } from '../common/Textarea.jsx';
import { Button } from '../common/Button.jsx';
import { Video, Mic, UploadCloud, FileSpreadsheet} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { createMeeting } from '../../services/meetings.js';
import { ImportTranscript } from './ImportTranscript.jsx';
import { uploadToStorage, confirmAttachmentUpload } from '../../services/attachments.js';
import { createProcessingJob, runProcessingJob, pollProcessingJob } from '../../services/processing.js';

export function CreateMeetingModal({ isOpen, onClose, onMeetingCreated }) {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [mode, setMode] = useState('upload');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => {
    const now = new Date();
    // format as YYYY-MM-DDTHH:mm
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const modeOptions = [
    {
      id: 'upload',
      title: 'Upload recording',
      desc: 'Upload an existing audio or video recording file.',
      icon: UploadCloud,
    },
    {
      id: 'mic_recording',
      title: 'Record in browser',
      desc: 'Use your microphone to record in-person or live audio.',
      icon: Mic,
    },
    {
      id: 'online',
      title: 'Online Meeting',
      desc: 'Create a meeting on Google Meet.',
      icon: Video,
    },
    {
      id: 'import',
      title: 'Import',
      desc: 'Use existing notes, summaries, or structured text.',
      icon: FileSpreadsheet,
    },
  ];

  const handleImportTranscript = async ({ file }) => {
    if (!currentWorkspace?.id) {
      setError('Please select or create a workspace first.');
      return;
    }
    if (!title.trim()) {
      setError('Meeting title is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isoDate = new Date(meetingDate).toISOString();
      const newMeeting = await createMeeting({
        workspace_id: currentWorkspace.id,
        title: title.trim(),
        description: description.trim(),
        mode: 'import',
        meeting_date: isoDate,
      });

      const uploaded = await uploadToStorage({
        file,
        bucket: 'meeting-files',
        workspaceId: currentWorkspace.id,
        meetingId: newMeeting.id,
      });

      const attachment = await confirmAttachmentUpload({
        meeting_id: newMeeting.id,
        bucket: 'meeting-files',
        path: uploaded.path,
        file_name: file.name,
        file_type: file.type || 'text/plain',
        file_size: file.size,
        attachment_type: 'meeting_attachment',
      });

      const job = await createProcessingJob({
        meeting_id: newMeeting.id,
        job_type: 'mom_generation',
        input_file_path: uploaded.path,
        source_attachment_id: attachment?.id || attachment?.attachment?.id,
      });

      await runProcessingJob(job.id);
      const completed = await pollProcessingJob(job.id);

      showToast('Meeting imported and MOM generated successfully', 'success');
      setTitle('');
      setDescription('');
      onClose();
      if (onMeetingCreated) {
        onMeetingCreated({ ...newMeeting, processing_job: completed });
      }
    } catch (err) {
      setError(err.message || 'Failed to import meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentWorkspace?.id) {
      setError('Please select or create a workspace first.');
      return;
    }
    if (!title.trim()) {
      setError('Meeting title is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Ensure ISO string with timezone offset
      const isoDate = new Date(meetingDate).toISOString();
      const newMeeting = await createMeeting({
        workspace_id: currentWorkspace.id,
        title: title.trim(),
        description: description.trim(),
        mode: mode === 'online' ? 'google_meet' : mode,
        meeting_date: isoDate,
      });

      showToast('Meeting created successfully', 'success');
      setTitle('');
      setDescription('');
      onClose();
      if (onMeetingCreated) {
        onMeetingCreated(newMeeting);
      }
    } catch (err) {
      setError(err.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Meeting"
      description={`Workspace: ${currentWorkspace?.name || 'Default'}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Capture Mode Choice */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            How would you like to capture this meeting?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {modeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = opt.id === 'online' ? mode === 'online' : mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-gradient bg-indigo-50/60 ring-1 ring-brand-gradient'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isSelected
                        ? 'bg-brand-gradient text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>
                      {opt.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Meeting Details */}
        <div className="space-y-3.5 pt-2">
          <Input
            label="Meeting Title"
            placeholder="e.g. Q4 Product Launch Roadmap"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError('');
            }}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              type="datetime-local"
              label="Meeting Date & Time"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              required
            />
          </div>

          <Textarea
            label="Description (Optional)"
            placeholder="Key objectives, agenda, or participants..."
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {mode === 'import' && (
          <ImportTranscript
            onImportTranscript={handleImportTranscript}
            loading={loading}
            disabled={loading}
          />
        )}

        {error && (
          <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {mode !== 'import' && (
            <Button type="submit" size="sm" loading={loading}>
              Create Meeting
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
