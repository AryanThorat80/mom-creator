import { useState, useEffect } from 'react';
import {
  FileText,
  Edit2,
  CheckCircle,
  Lock,
  Download,
  Printer,
  FileSpreadsheet,
  Save,
  X,
  Sparkles,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { MOMStatusBadge } from '../common/StatusBadge.jsx';
import { ListFieldEditor } from './ListFieldEditor.jsx';
import { AbbreviationsEditor } from './AbbreviationsEditor.jsx';
import { TranscriptViewer } from './TranscriptViewer.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { Modal } from '../common/Modal.jsx';
import { updateMOM, reviewMOM, finalizeMOM } from '../../services/moms.js';
import { downloadDocx, downloadExcel, getPrintableMOM } from '../../services/exports.js';
import { useToast } from '../../context/ToastContext.jsx';

export function MOMEditor({
  mom,
  meeting,
  onReload,
}) {
  const { showToast } = useToast();

  const isFinalized = mom?.status === 'finalized';
  const isReviewed = mom?.status === 'reviewed';
  const isDraft = !mom?.status || mom?.status === 'draft';

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [discussionPoints, setDiscussionPoints] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [nextSteps, setNextSteps] = useState([]);
  const [abbreviations, setAbbreviations] = useState({});

  // Transition & Export loaders
  const [transitioning, setTransitioning] = useState(false);
  const [exportLoading, setExportLoading] = useState(null); // 'docx' | 'excel' | 'printable'
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [printableHtml, setPrintableHtml] = useState(null);

  useEffect(() => {
    if (mom) {
      setTitle(mom.title || '');
      setSummary(mom.summary || '');
      setDiscussionPoints(Array.isArray(mom.key_discussion_points) ? mom.key_discussion_points : []);
      setDecisions(Array.isArray(mom.decisions) ? mom.decisions : []);
      setNextSteps(Array.isArray(mom.next_steps) ? mom.next_steps : []);
      setAbbreviations(mom.abbreviations_used || {});
      setIsEditing(false);
    }
  }, [mom]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMOM(mom.id, {
        title: title.trim(),
        summary: summary.trim(),
        key_discussion_points: discussionPoints.filter(Boolean),
        decisions: decisions.filter(Boolean),
        next_steps: nextSteps.filter(Boolean),
        abbreviations_used: abbreviations,
      });
      showToast('MOM updated successfully', 'success');
      setIsEditing(false);
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message || 'Failed to update MOM', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async () => {
    setTransitioning(true);
    try {
      await reviewMOM(mom.id);
      showToast('MOM marked as Reviewed', 'success');
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message || 'Failed to review MOM', 'error');
    } finally {
      setTransitioning(false);
    }
  };

  const handleFinalize = async () => {
    setTransitioning(true);
    try {
      await finalizeMOM(mom.id);
      showToast('MOM finalized and locked', 'success');
      setFinalizeConfirmOpen(false);
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message || 'Failed to finalize MOM', 'error');
    } finally {
      setTransitioning(false);
    }
  };

  const handleExportDocx = async () => {
    setExportLoading('docx');
    try {
      await downloadDocx(meeting.id);
      showToast('DOCX document downloaded', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to export DOCX', 'error');
    } finally {
      setExportLoading(null);
      setExportMenuOpen(false);
    }
  };

  const handleExportExcel = async () => {
    setExportLoading('excel');
    try {
      await downloadExcel(meeting.id);
      showToast('Excel spreadsheet downloaded', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to export Excel', 'error');
    } finally {
      setExportLoading(null);
      setExportMenuOpen(false);
    }
  };

  const handlePrintable = async () => {
    setExportLoading('printable');
    try {
      const html = await getPrintableMOM(meeting.id);
      setPrintableHtml(html);
    } catch (err) {
      showToast(err.message || 'Failed to load printable view', 'error');
    } finally {
      setExportLoading(null);
      setExportMenuOpen(false);
    }
  };

  if (!mom) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center space-y-2">
        <p className="text-sm font-semibold text-slate-700">No Minutes of Meeting yet</p>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Upload an audio or video recording, record through your browser, or sync from an Online Meeting to generate the structured MOM.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Document Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <MOMStatusBadge status={mom.status} />
            {isFinalized && (
              <span className="text-xs text-slate-400">
                This document is locked against edits.
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {title || 'Minutes of Meeting'}
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit / Save controls */}
          {!isFinalized && (
            <>
              {isEditing ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      // Reset values
                      setTitle(mom.title || '');
                      setSummary(mom.summary || '');
                      setDiscussionPoints(mom.key_discussion_points || []);
                      setDecisions(mom.decisions || []);
                      setNextSteps(mom.next_steps || []);
                      setAbbreviations(mom.abbreviations_used || {});
                    }}
                    disabled={saving}
                    icon={X}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    loading={saving}
                    icon={Save}
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  icon={Edit2}
                >
                  Edit MOM
                </Button>
              )}
            </>
          )}

          {/* Workflow Transitions: Draft -> Reviewed -> Finalized */}
          {!isFinalized && !isEditing && (
            <>
              {isDraft && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReview}
                  loading={transitioning}
                  icon={CheckCircle}
                >
                  Mark as Reviewed
                </Button>
              )}

              {isReviewed && (
                <Button
                  size="sm"
                  onClick={() => setFinalizeConfirmOpen(true)}
                  loading={transitioning}
                  icon={Lock}
                >
                  Finalize & Lock
                </Button>
              )}
            </>
          )}

          {/* Export Menu */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              icon={Download}
              iconRight={ChevronDown}
              loading={Boolean(exportLoading)}
            >
              <span>{exportLoading ? `Preparing ${exportLoading}...` : 'Export'}</span>
            </Button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={handleExportDocx}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <div>
                    <p className="font-medium">Word Document</p>
                    <p className="text-[10px] text-slate-400">Formatted .docx</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <div>
                    <p className="font-medium">Excel Spreadsheet</p>
                    <p className="text-[10px] text-slate-400">Structured .xlsx</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handlePrintable}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer border-t border-slate-100"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <div>
                    <p className="font-medium">Printable / PDF</p>
                    <p className="text-[10px] text-slate-400">A4 layout print preview</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Document Content */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-7 shadow-xs">
        {/* Title editing */}
        {isEditing && (
          <div className="space-y-1.5 pb-4 border-b border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              MOM Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-base font-bold text-slate-900 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
        )}

        {/* Executive Summary */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>Executive Summary</span>
          </h3>
          {isEditing ? (
            <textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Enter meeting summary..."
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-y"
            />
          ) : (
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
              {summary || <span className="text-slate-400 italic">No summary provided.</span>}
            </p>
          )}
        </section>

        {/* Key Discussion Points */}
        <section className="space-y-3 pt-5 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Key Discussion Points
          </h3>
          <ListFieldEditor
            items={discussionPoints}
            onChange={setDiscussionPoints}
            isEditing={isEditing}
            placeholder="Add key discussion point..."
            addLabel="Add discussion point"
          />
        </section>

        {/* Decisions */}
        <section className="space-y-3 pt-5 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Decisions Reached
          </h3>
          <ListFieldEditor
            items={decisions}
            onChange={setDecisions}
            isEditing={isEditing}
            placeholder="Add decision..."
            addLabel="Add decision"
          />
        </section>

        {/* Next Steps */}
        <section className="space-y-3 pt-5 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Next Steps
          </h3>
          <ListFieldEditor
            items={nextSteps}
            onChange={setNextSteps}
            isEditing={isEditing}
            placeholder="Add next step..."
            addLabel="Add next step"
          />
        </section>

        {/* Abbreviations Used */}
        <section className="space-y-3 pt-5 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Abbreviations & Definitions
          </h3>
          <AbbreviationsEditor
            abbreviations={abbreviations}
            onChange={setAbbreviations}
            isEditing={isEditing}
          />
        </section>
      </div>

      {/* Transcript Component */}
      <TranscriptViewer transcript={mom.transcript} />

      {/* Confirm Finalize Dialog */}
      <ConfirmDialog
        isOpen={finalizeConfirmOpen}
        onClose={() => setFinalizeConfirmOpen(false)}
        onConfirm={handleFinalize}
        title="Finalize Minutes of Meeting"
        message="Finalizing this MOM will lock it permanently. Once finalized, no further edits to the summary, discussion points, or decisions can be made."
        confirmText="Finalize & Lock"
        variant="primary"
        loading={transitioning}
      />

      {/* Printable MOM Preview Modal */}
      <Modal
        isOpen={Boolean(printableHtml)}
        onClose={() => setPrintableHtml(null)}
        title="Printable Minutes of Meeting"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs text-slate-500">
              Formatted document ready for printing or saving as PDF.
            </span>
            <Button
              size="sm"
              icon={Printer}
              onClick={() => {
                const iframe = document.getElementById('printable-mom-frame');
                if (iframe?.contentWindow) {
                  iframe.contentWindow.focus();
                  iframe.contentWindow.print();
                }
              }}
            >
              Print Document
            </Button>
          </div>

          <div className="w-full h-[65vh] border border-slate-200 rounded-lg overflow-hidden bg-white">
            <iframe
              id="printable-mom-frame"
              title="Printable MOM Preview"
              srcDoc={printableHtml || ''}
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
