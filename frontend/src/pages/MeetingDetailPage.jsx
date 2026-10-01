import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Calendar,
  Edit2,
  Trash2,
  Share2,
  Video,
  Mic,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  FileDown,
} from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Textarea } from '../components/common/Textarea.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { MeetingStatusBadge, MeetingModeBadge } from '../components/common/StatusBadge.jsx';
import { BrowserRecorder } from '../components/meeting/BrowserRecorder.jsx';
import { UploadRecording } from '../components/meeting/UploadRecording.jsx';
import { GoogleMeetCard } from '../components/integrations/GoogleMeetCard.jsx';
import { ProcessingProgress } from '../components/meeting/ProcessingProgress.jsx';
import { AttachmentsList } from '../components/meeting/AttachmentsList.jsx';
import { MOMEditor } from '../components/mom/MOMEditor.jsx';
import { ActionItemsTable } from '../components/actionItems/ActionItemsTable.jsx';
import { MeetingParticipants } from '../components/mom/MeetingParticipants.jsx';
import { getMeeting, updateMeeting, deleteMeeting } from '../services/meetings.js';
import { uploadToStorage, confirmAttachmentUpload } from '../services/attachments.js';
import { createProcessingJob, runProcessingJob, pollProcessingJob } from '../services/processing.js';
import { getMOM, getMOMByMeeting } from '../services/moms.js';
import { listActionItems } from '../services/actionItems.js';
import { listMeetingParticipants } from '../services/meetingParticipants.js';
import { useToast } from '../context/ToastContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { exportMOMPdf } from '../services/exports.js';

export function MeetingDetailPage({
  meetingId,
  onBack,
  onNavigate,
}) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [meeting, setMeeting] = useState(null);
  const [mom, setMom] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Meeting Details Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [savingMeeting, setSavingMeeting] = useState(false);

  // Delete Meeting Dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Processing state
  const [processingStage, setProcessingStage] = useState('idle'); // idle | uploading | transcribing | generating_mom | completed | failed
  const [processingError, setProcessingError] = useState(null);
  const [lastUploadedPath, setLastUploadedPath] = useState(null);

  const loadAllData = useCallback(async () => {
    if (!meetingId) return;
    try {
      const meetingData = await getMeeting(meetingId);
      setMeeting(meetingData);

      // Load action items
      try {
        const actionsData = await listActionItems(meetingId);
        setActionItems(Array.isArray(actionsData) ? actionsData : []);
      } catch {
        setActionItems([]);
      }

      // Load manually entered meeting participants
      try {
        const participantsData = await listMeetingParticipants(meetingId);
        setParticipants(Array.isArray(participantsData) ? participantsData : []);
      } catch {
        setParticipants([]);
      }

      // Load MOM for this meeting
      try {
        const momData = await getMOMByMeeting(meetingId);
        setMom(momData);
      } catch {
        setMom(null);
      }
    } catch (err) {
      console.error('Error loading meeting details:', err);
      showToast(err.message || 'Failed to load meeting', 'error');
    } finally {
      setLoading(false);
    }
  }, [meetingId, showToast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Primary recording upload & full processing pipeline
  const processRecordingFile = async (file, customName, mediaType = null) => {
    if (!meeting || !currentWorkspace) return;

    setProcessingError(null);
    setProcessingStage('uploading');

    try {
      const fileName =file?.name || customName || `recording_${Date.now()}.webm`;

      const extension = fileName.split('.').pop()?.toLowerCase();

      const videoExtensions = ['mp4', 'mov', 'm4v'];
      const audioExtensions = ['mp3', 'wav', 'm4a', 'aac'];

      let bucket;

      if (mediaType === 'audio') {
        bucket = 'meeting-audio';
      } else if (mediaType === 'video') {
        bucket = 'meeting-video';
      } else if (videoExtensions.includes(extension)) {
        bucket = 'meeting-video';
      } else if (audioExtensions.includes(extension)) {
        bucket = 'meeting-audio';
      } else if (extension === 'webm') {
        bucket = file.type.startsWith('video/')
          ? 'meeting-video'
          : 'meeting-audio';
      } else {
        throw new Error(`Unsupported recording format: .${extension}`);
      }

      // 1. Upload to Supabase Storage
      const uploaded = await uploadToStorage({
        file,
        bucket,
        workspaceId: meeting.workspace_id,
        meetingId: meeting.id,
        customFileName: customName,
      });

      setLastUploadedPath(uploaded.path);

      // 2. Create Transcription Job
      setProcessingStage('transcribing');

      const txJob = await createProcessingJob({
        meeting_id: meeting.id,
        job_type: 'transcription',
        input_file_path: uploaded.path,
      });

      await runProcessingJob(txJob.id);

      // 3. Poll Transcription Job
      await pollProcessingJob(txJob.id);

      // 4. Create MOM Generation Job
      setProcessingStage('generating_mom');

      const momJob = await createProcessingJob({
        meeting_id: meeting.id,
        job_type: 'mom_generation',
      });

      await runProcessingJob(momJob.id);

      // 5. Poll MOM Generation Job
      const finishedJob = await pollProcessingJob(momJob.id);

      setProcessingStage('completed');
      showToast('Transcription and MOM generation completed!', 'success');

      // Reload all meeting data
      await loadAllData();
    } catch (err) {
      console.error('Processing failed:', err);
      setProcessingStage('failed');
      setProcessingError(err.message || 'Processing encountered an error.');
      showToast(err.message || 'Processing failed', 'error');
    }
  };

  // Google Meet transcript synced callback -> kick off MOM generation!
  const handleMeetTranscriptSynced = async (syncRes) => {
    try {
      setProcessingStage('generating_mom');
      const momJob = await createProcessingJob({
        meeting_id: meeting.id,
        job_type: 'mom_generation',
      });

      await runProcessingJob(momJob.id);
      await pollProcessingJob(momJob.id);

      setProcessingStage('completed');
      showToast('MOM generated from Google Meet transcript', 'success');
      await loadAllData();
    } catch (err) {
      setProcessingStage('failed');
      setProcessingError(err.message || 'Failed to generate MOM from transcript');
    }
  };

  const handleOpenEditModal = () => {
    if (!meeting) return;
    setEditTitle(meeting.title || '');
    setEditDesc(meeting.description || '');
    if (meeting.meeting_date) {
      const d = new Date(meeting.meeting_date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      setEditDate(`${year}-${month}-${day}T${hours}:${mins}`);
    } else {
      setEditDate('');
    }
    setEditModalOpen(true);
  };

  const handleSaveMeetingDetails = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    setSavingMeeting(true);
    try {
      const isoDate = editDate ? new Date(editDate).toISOString() : undefined;
      await updateMeeting(meeting.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        meeting_date: isoDate,
      });
      showToast('Meeting updated', 'success');
      setEditModalOpen(false);
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Failed to update meeting', 'error');
    } finally {
      setSavingMeeting(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      await exportMOMPdf(meeting.id);
      showToast('MOM PDF exported successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to export MOM PDF', 'error');
    }
  };

  const handleDeleteMeeting = async () => {
    setDeleting(true);
    try {
      await deleteMeeting(meeting.id);
      showToast('Meeting deleted', 'success');
      onBack();
    } catch (err) {
      showToast(err.message || 'Failed to delete meeting', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date specified';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="h-8 w-48 rounded bg-slate-200 animate-pulse" />
        <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-96 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center space-y-4">
        <p className="text-sm font-semibold text-slate-800">Meeting Not Found</p>
        <p className="text-xs text-slate-500">The requested meeting could not be loaded or was deleted.</p>
        <Button size="sm" onClick={onBack} icon={ArrowLeft}>
          Back to Meetings
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
      {/* Top Navigation & Meeting Header */}
      <div className="space-y-3 pb-5 border-b border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Meetings</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <MeetingModeBadge mode={meeting.mode} />
              <span className="text-slate-300">·</span>
              <MeetingStatusBadge status={meeting.status} />
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {formatDate(meeting.meeting_date || meeting.created_at)}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {meeting.title}
            </h1>
            {meeting.description && (
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                {meeting.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenEditModal}
              icon={Edit2}
            >
              Edit Details
            </Button>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              title="Delete meeting"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              aria-label="Delete meeting"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary Capture / Recording Panel */}
      {(!mom || processingStage !== 'idle') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Meeting Capture & Recording
            </h3>
          </div>

          {processingStage !== 'idle' ? (
            <ProcessingProgress
              stage={processingStage}
              error={processingError}
              onRetry={() => {
                if (lastUploadedPath) {
                  // Retry transcription
                  setProcessingStage('transcribing');
                  createProcessingJob({ meeting_id: meeting.id, job_type: 'transcription', input_file_path: lastUploadedPath })
                    .then((j) => runProcessingJob(j.id))
                    .then(() => pollProcessingJob(meeting.id))
                    .then(() => createProcessingJob({ meeting_id: meeting.id, job_type: 'mom_generation' }))
                    .then((mj) => runProcessingJob(mj.id))
                    .then(() => pollProcessingJob(meeting.id))
                    .then(() => {
                      setProcessingStage('completed');
                      loadAllData();
                    })
                    .catch((err) => {
                      setProcessingStage('failed');
                      setProcessingError(err.message);
                    });
                }
              }}
            />
          ) : (
            <>
              {meeting.mode === 'mic_recording' && (
                <BrowserRecorder
                  onRecordingComplete={(blob, name) => processRecordingFile(blob, name, 'audio')}
                />
              )}

              {meeting.mode === 'upload' && (
                <UploadRecording
                  onUploadFile={(file) => processRecordingFile(file)}
                />
              )}

              {meeting.mode === 'google_meet' && (
                <GoogleMeetCard
                  meetingId={meeting.id}
                  onTranscriptSynced={handleMeetTranscriptSynced}
                />
              )}

              {meeting.mode === 'import' && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-center">
                  <p className="text-xs font-semibold text-slate-800">Direct MOM Generation</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Generate the structured MOM from existing meeting transcripts or notes.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setProcessingStage('generating_mom');
                      createProcessingJob({ meeting_id: meeting.id, job_type: 'mom_generation' })
                        .then((j) => runProcessingJob(j.id))
                        .then(() => pollProcessingJob(meeting.id))
                        .then(() => {
                          setProcessingStage('completed');
                          loadAllData();
                        })
                        .catch((err) => {
                          setProcessingStage('failed');
                          setProcessingError(err.message);
                        });
                    }}
                    icon={Sparkles}
                  >
                    Generate MOM
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Participants */}
      <MeetingParticipants
        meetingId={meeting.id}
        participants={participants}
        canEdit={String(meeting.created_by) === String(user?.id)}
        onReload={loadAllData}
      />

      {/* Main Minutes of Meeting Document */}
      <div className="space-y-4">
        <MOMEditor
          mom={mom}
          meeting={meeting}
          onReload={loadAllData}
        />
      </div>

      {/* Action Items Component */}
      <div className="space-y-4">
        <ActionItemsTable
          meetingId={meeting.id}
          actionItems={actionItems}
          onReload={loadAllData}
          disabled={mom?.status === 'finalized'}
        />
      </div>

      {/* Supporting Attachments Component */}
      <div className="space-y-4">
        <AttachmentsList
          meetingId={meeting.id}
          workspaceId={meeting.workspace_id}
          onAttachmentUploaded={loadAllData}
        />
      </div>

      {/* Edit Details Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Meeting Details"
        description="Update meeting title, description, or scheduled date."
      >
        <form onSubmit={handleSaveMeetingDetails} className="space-y-4">
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
            autoFocus
          />

          <Input
            type="datetime-local"
            label="Meeting Date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
          />

          <Textarea
            label="Description"
            rows={3}
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={savingMeeting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Meeting Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteMeeting}
        title="Delete Meeting"
        message={`Are you sure you want to permanently delete "${meeting.title}"? All minutes, action items, and attachments will be removed.`}
        confirmText="Delete Meeting"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
