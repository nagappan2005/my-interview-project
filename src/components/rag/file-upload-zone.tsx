'use client';

import React, { useCallback, useState, useRef } from 'react';
import { useChatStore, DocumentInfo } from '@/store/chat-store';
import { Upload, FileText, File, X, Loader2, CheckCircle2, AlertCircle, Database, HardDrive, Trash2, ToggleLeft, ToggleRight, ChevronDown, Calendar, Hash, Type, FileUp, RefreshCw } from 'lucide-react';
import { DocumentSearch } from '@/components/rag/document-search';
import { Progress } from '@/components/ui/progress';
import { formatFileSize } from '@/lib/format';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DocDetail {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: string;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
  chunkPreview: string | null;
}

// ─── Document Info Panel ─────────────────────────────────────────────
function DocumentInfoPanel({ doc, detail }: { doc: DocumentInfo; detail: DocDetail | null }) {
  const fileTypeColor = doc.fileType === 'pdf'
    ? 'bg-red-500/10 text-red-400/80 border-red-500/10'
    : 'bg-blue-500/10 text-blue-400/80 border-blue-500/10';

  const fileTypeLabel = doc.fileType === 'pdf' ? 'PDF' : 'TXT';

  const statusConfig: Record<string, { color: string; label: string }> = {
    ready: { color: 'text-emerald-400/60 bg-emerald-500/10', label: 'Ready' },
    processing: { color: 'text-amber-400/60 bg-amber-500/10', label: 'Processing' },
    error: { color: 'text-red-400/60 bg-red-500/10', label: 'Error' },
  };

  const status = statusConfig[doc.status] || statusConfig.ready;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="px-2 pb-2 pt-1 space-y-2">
        {/* File name (full) */}
        <div className="flex items-start gap-1.5">
          <Type size={9} className="text-white/40 mt-0.5 shrink-0" />
          <p className="text-[10px] text-white/70 break-all leading-relaxed">{doc.filename}</p>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* File type badge */}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-medium ${fileTypeColor}`}>
            {fileTypeLabel}
          </span>
          {/* Status badge */}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${status.color}`}>
            {status.label}
          </span>
          {/* Size */}
          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-white/60">
            {formatFileSize(doc.fileSize)}
          </span>
        </div>

        {/* Details row */}
        <div className="flex items-center gap-3 text-[9px] text-white/50">
          <div className="flex items-center gap-1">
            <Hash size={8} className="text-purple-400/50" />
            <span>{doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={8} className="text-purple-400/50" />
            <span>{detail ? formatDate(detail.createdAt) : formatDate(doc.createdAt)}</span>
          </div>
        </div>

        {/* Chunk preview */}
        {detail?.chunkPreview && (
          <div className="mt-1">
            <p className="text-[9px] text-white/40 mb-0.5">Preview:</p>
            <div className="text-[9px] text-white/60 leading-relaxed bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 whitespace-pre-wrap break-words max-h-16 overflow-y-auto scroll-fade">
              {detail.chunkPreview}{detail.chunkPreview.length >= 100 ? '...' : ''}
            </div>
          </div>
        )}

        {/* Loading state for details */}
        {!detail && (
          <div className="flex items-center gap-1.5 text-[9px] text-white/40">
            <Loader2 size={8} className="animate-spin" />
            <span>Loading details...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface FileUploadZoneProps {
  fileInputTriggerRef?: React.MutableRefObject<(() => void) | null>;
}

export function FileUploadZone({ fileInputTriggerRef }: FileUploadZoneProps) {
  const {
    isUploading,
    uploadProgress,
    documents,
    setUploading,
    setUploadProgress,
    addDocument,
    removeDocument,
    toggleDocumentEnabled,
    enableAllDocuments,
  } = useChatStore();

  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const [reuploadDocId, setReuploadDocId] = useState<string | null>(null);
  const [reuploadFilename, setReuploadFilename] = useState<string>('');
  const [reuploadConfirmOpen, setReuploadConfirmOpen] = useState(false);
  const [reuploadPosition, setReuploadPosition] = useState<number>(-1);

  // Register the file input trigger with the parent
  React.useEffect(() => {
    if (fileInputTriggerRef) {
      fileInputTriggerRef.current = () => fileInputRef.current?.click();
    }
  });
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [docDetails, setDocDetails] = useState<Record<string, DocDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  const enabledDocs = documents.filter((d) => d.enabled && d.status === 'ready');
  const totalChunks = enabledDocs.reduce((sum, d) => sum + d.chunkCount, 0);
  const totalSize = documents.reduce((sum, d) => sum + d.fileSize, 0);
  const hasDisabledDocs = documents.some((d) => !d.enabled);

  const toggleExpandDoc = useCallback(async (docId: string) => {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
      return;
    }

    setExpandedDocId(docId);

    // Fetch details if not already loaded
    if (!docDetails[docId] && !loadingDetails.has(docId)) {
      setLoadingDetails((prev) => new Set(prev).add(docId));
      try {
        const response = await fetch(`/api/documents/${docId}`);
        if (response.ok) {
          const data = await response.json();
          setDocDetails((prev) => ({ ...prev, [docId]: data }));
        }
      } catch (error) {
        console.error('Failed to fetch document details:', error);
      } finally {
        setLoadingDetails((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
      }
    }
  }, [expandedDocId, docDetails, loadingDetails]);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext !== 'pdf' && ext !== 'txt') {
        setUploadError('Only PDF and TXT files are supported.');
        toast.error('Unsupported file type. Only PDF and TXT files are accepted.');
        setTimeout(() => setUploadError(null), 4000);
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        setUploadError('File size must be under 20MB.');
        toast.error('File too large. Maximum size is 20MB.');
        setTimeout(() => setUploadError(null), 4000);
        return;
      }

      setUploadError(null);
      setUploading(true);
      setUploadProgress(0);

      try {
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 12, 85));
        }, 250);

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        addDocument({
          id: data.id,
          filename: data.filename,
          fileType: data.fileType,
          fileSize: data.fileSize,
          status: data.status,
          chunkCount: data.chunkCount,
          createdAt: new Date().toISOString(),
        });

        toast.success(`"${data.filename}" uploaded`, {
          description: `${data.chunkCount} chunks indexed and ready for queries`,
        });

        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 500);
      } catch (error) {
        setUploading(false);
        setUploadProgress(0);
        const msg = error instanceof Error ? error.message : 'Upload failed';
        setUploadError(msg);
        toast.error('Upload failed', { description: msg });
        setTimeout(() => setUploadError(null), 5000);
      }
    },
    [addDocument, setUploadProgress, setUploading]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFile]
  );

  const handleDelete = useCallback(
    async (id: string, filename: string) => {
      try {
        await fetch('/api/documents', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        removeDocument(id);
        // Clear expanded state and cached details
        if (expandedDocId === id) setExpandedDocId(null);
        setDocDetails((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        toast.success(`"${filename}" removed`);
      } catch (error) {
        console.error('Failed to delete document:', error);
        toast.error('Failed to remove document');
      }
    },
    [removeDocument, expandedDocId]
  );

  // ─── Re-upload flow ────────────────────────────────────────────────
  const handleReuploadClick = useCallback((e: React.MouseEvent, doc: DocumentInfo) => {
    e.stopPropagation();
    setReuploadDocId(doc.id);
    setReuploadFilename(doc.filename);
    // Store the position of the doc in the list
    const idx = documents.findIndex((d) => d.id === doc.id);
    setReuploadPosition(idx);
    setReuploadConfirmOpen(true);
  }, [documents]);

  const handleReuploadConfirm = useCallback(() => {
    setReuploadConfirmOpen(false);
    if (reuploadInputRef.current) {
      reuploadInputRef.current.click();
    }
  }, []);

  const handleReuploadFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !reuploadDocId) return;

      // Validate file type
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext !== 'pdf' && ext !== 'txt') {
        toast.error('Only PDF and TXT files are supported for re-upload.');
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 20MB.');
        return;
      }

      const targetDocId = reuploadDocId;
      const targetFilename = reuploadFilename;
      const position = reuploadPosition;

      toast.loading(`Replacing "${targetFilename}"...`, { id: 'reupload' });

      // Delete old document
      try {
        await fetch('/api/documents', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetDocId }),
        });
        removeDocument(targetDocId);
        if (expandedDocId === targetDocId) setExpandedDocId(null);
        setDocDetails((prev) => {
          const next = { ...prev };
          delete next[targetDocId];
          return next;
        });
      } catch {
        toast.error('Failed to remove old document', { id: 'reupload' });
        return;
      }

      // Upload new file
      setUploadError(null);
      setUploading(true);
      setUploadProgress(0);

      try {
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 12, 85));
        }, 250);

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        addDocument({
          id: data.id,
          filename: data.filename,
          fileType: data.fileType,
          fileSize: data.fileSize,
          status: data.status,
          chunkCount: data.chunkCount,
          createdAt: new Date().toISOString(),
        });

        toast.success(`"${data.filename}" replaced successfully`, {
          id: 'reupload',
          description: `${data.chunkCount} chunks indexed`,
        });

        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 500);
      } catch (error) {
        setUploading(false);
        setUploadProgress(0);
        const msg = error instanceof Error ? error.message : 'Upload failed';
        toast.error('Re-upload failed', { id: 'reupload', description: msg });
      } finally {
        setReuploadDocId(null);
        setReuploadFilename('');
        setReuploadPosition(-1);
        if (reuploadInputRef.current) {
          reuploadInputRef.current.value = '';
        }
      }
    },
    [reuploadDocId, reuploadFilename, reuploadPosition, removeDocument, expandedDocId, addDocument, setUploading, setUploadProgress]
  );

  const handleDeleteAll = useCallback(async () => {
    try {
      await fetch('/api/documents/delete-all', { method: 'DELETE' });
      const { setDocuments } = useChatStore.getState();
      setDocuments([]);
      setExpandedDocId(null);
      setDocDetails({});
      toast.success('All documents removed');
    } catch (error) {
      console.error('Failed to delete all documents:', error);
      toast.error('Failed to remove all documents');
    }
  }, []);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Document Search */}
      <DocumentSearch
        onSelectChunk={(content) => {
          window.dispatchEvent(new CustomEvent('docqa:prefill', { detail: content }));
        }}
      />

      {/* Hidden re-upload file input */}
      <input
        ref={reuploadInputRef}
        type="file"
        accept=".pdf,.txt"
        onChange={handleReuploadFileSelect}
        className="hidden"
      />

      {/* Re-upload Confirmation Dialog */}
      <AlertDialog open={reuploadConfirmOpen} onOpenChange={setReuploadConfirmOpen}>
        <AlertDialogContent className="bg-[#161923] border-white/[0.1]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white/80 text-sm">Replace &ldquo;{reuploadFilename}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70 text-xs">
              This will delete the current document and upload a new version. The existing chunks will be replaced with new ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.06] border-white/[0.1] text-white/60 hover:bg-white/[0.08] text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReuploadConfirm}
              className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border-0 text-xs h-8"
            >
              Choose new file
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center
          transition-all duration-300 ease-out
          ${isDragging
            ? 'border-purple-500/60 bg-purple-500/[0.08] scale-[1.02] shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/20 drag-active'
            : 'border-white/[0.1] hover:border-purple-500/25 hover:bg-white/[0.04]'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        {/* Pulsing glow when dragging */}
        {isDragging && (
          <div className="absolute inset-0 rounded-2xl animate-pulse-soft pointer-events-none">
            <div className="absolute inset-0 rounded-2xl bg-purple-500/[0.06] blur-sm" />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2 relative z-10">
          <div
            className={`
              w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300
              ${isDragging
                ? 'bg-purple-500/20 text-purple-400 scale-110 animate-breathe'
                : 'bg-white/[0.06] text-white/65 border border-white/[0.08] hover:border-purple-500/15 hover:text-purple-400/65'
              }
            `}
          >
            <Upload size={17} />
          </div>
          <div>
            <p className="text-xs font-medium text-white/60">
              {isDragging ? 'Drop your file here' : 'Drop PDF or TXT here'}
            </p>
            <p className="text-[10px] text-white/55 mt-0.5">
              or click to browse • Max 20MB
            </p>
          </div>
        </div>

        {/* Upload Progress */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#0f1117]/80 backdrop-blur-sm"
            >
              <div className="w-full max-w-[80%] flex flex-col items-center gap-2.5">
                <Loader2 size={20} className="animate-spin text-purple-400" />
                <Progress value={uploadProgress} className="h-1.5 w-full" />
                <p className="text-[10px] text-white/80">
                  {uploadProgress < 40 ? 'Reading document...' : uploadProgress < 80 ? 'Chunking & indexing...' : 'Finalizing...'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/15 px-3 py-2 text-[11px] text-red-400/80"
          >
            <AlertCircle size={13} className="shrink-0" />
            <span className="truncate">{uploadError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Bar + Actions */}
      {documents.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] text-white/55">
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-md px-1.5 py-0.5">
              <Database size={8} className="text-purple-400/60" />
              <span>{totalChunks} chunks</span>
            </div>
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-md px-1.5 py-0.5">
              <HardDrive size={8} className="text-purple-400/60" />
              <span>{formatFileSize(totalSize)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasDisabledDocs && (
              <button
                onClick={(e) => { e.stopPropagation(); enableAllDocuments(); }}
                className="text-[9px] text-purple-400/60 hover:text-purple-400/85 transition-colors px-1.5 py-0.5 rounded-md hover:bg-purple-500/[0.08]"
                title="Enable all documents"
              >
                Enable all
              </button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="text-[9px] text-white/40 hover:text-red-400/65 transition-colors px-1.5 py-0.5 rounded-md hover:bg-red-500/[0.08]"
                  title="Remove all documents"
                >
                  Delete all
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#161923] border-white/[0.1]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white/80 text-sm">Delete all documents?</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/70 text-xs">
                    This will remove all {documents.length} document{documents.length !== 1 ? 's' : ''} and their indexed chunks. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/[0.06] border-white/[0.1] text-white/60 hover:bg-white/[0.08] text-xs h-8">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAll}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0 text-xs h-8"
                  >
                    Delete all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-y-auto min-h-0 scroll-fade">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[9px] font-semibold uppercase tracking-widest text-white/50">
            Documents
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/35">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
            {documents.length > 0 && (
              <span className="text-[8px] text-white/30 border-l border-white/[0.08] pl-2">
                Recently uploaded
              </span>
            )}
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ duration: 0.2 }}
              className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3 group/empty cursor-default hover:border-purple-500/10 hover:bg-purple-500/[0.05] transition-colors"
            >
              <FileUp size={20} className="text-white/25 group-hover/empty:text-purple-400/50 transition-colors" />
            </motion.div>
            <p className="text-[11px] text-white/50">No documents uploaded yet</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              Upload a PDF or TXT to start
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {documents.map((doc, idx) => {
              // File type accent color
              const accentColor = doc.fileType === 'pdf'
                ? 'border-l-red-400/40 hover:border-l-red-400/60'
                : 'border-l-blue-400/40 hover:border-l-blue-400/60';

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  className={`
                    rounded-lg transition-all border-l-2 ${accentColor}
                    ${doc.enabled !== false
                      ? 'hover:bg-white/[0.05] border-t border-r border-b border-transparent hover:border-white/[0.06]'
                      : 'bg-white/[0.02] border-t border-r border-b border-white/[0.05] opacity-50'
                    }
                    ${expandedDocId === doc.id ? 'bg-white/[0.04] border-t border-r border-b border-white/[0.06]' : ''}
                  `}
                >
                  {/* Document row - clickable to expand */}
                  <div
                    className="group flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                    onClick={() => toggleExpandDoc(doc.id)}
                  >
                    {/* Toggle switch */}
                    {doc.status === 'ready' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleDocumentEnabled(doc.id); }}
                        className="shrink-0 transition-colors"
                        title={doc.enabled !== false ? 'Exclude from search' : 'Include in search'}
                        aria-label={doc.enabled !== false ? 'Exclude from search' : 'Include in search'}
                      >
                        {doc.enabled !== false ? (
                          <ToggleRight size={16} className="text-purple-400/70 hover:text-purple-400/80" />
                        ) : (
                          <ToggleLeft size={16} className="text-white/40 hover:text-white/60" />
                        )}
                      </button>
                    )}
                    {doc.status !== 'ready' && <div className="w-4 shrink-0" />}

                    {/* File icon with type-specific color */}
                    <div
                      className={`
                        w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                        ${doc.fileType === 'pdf'
                          ? 'bg-red-500/15 text-red-400/80 border border-red-500/15'
                          : 'bg-blue-500/15 text-blue-400/80 border border-blue-500/15'
                        }
                      `}
                    >
                      <File size={12} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-medium truncate ${doc.enabled !== false ? 'text-white/85' : 'text-white/60'}`}>
                        {doc.filename}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-white/45">
                          {formatFileSize(doc.fileSize)}
                        </span>
                        {doc.status === 'ready' && (
                          <span className="text-[9px] text-emerald-400/60">
                            {doc.chunkCount} chunks
                          </span>
                        )}
                        {doc.status === 'processing' && (
                          <span className="text-[9px] text-amber-400/60 animate-soft-pulse">
                            Processing...
                          </span>
                        )}
                        {doc.status === 'error' && (
                          <span className="text-[9px] text-red-400/60">Failed</span>
                        )}
                      </div>
                      {/* Subtle progress/status bar */}
                      {doc.status === 'processing' && (
                        <div className="mt-1 h-0.5 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400/40 animate-soft-pulse" style={{ width: '60%' }} />
                        </div>
                      )}
                      {doc.status === 'ready' && (
                        <div className="mt-1 h-0.5 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-400/30" style={{ width: '100%' }} />
                        </div>
                      )}
                      {doc.status === 'error' && (
                        <div className="mt-1 h-0.5 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full bg-red-400/30" style={{ width: '30%' }} />
                        </div>
                      )}
                    </div>

                    {/* Chevron + Status + Delete */}
                    <div className="flex items-center gap-0.5">
                      {doc.status === 'ready' && (
                        <CheckCircle2 size={11} className="text-emerald-400/45" />
                      )}
                      {doc.status === 'error' && (
                        <AlertCircle size={11} className="text-red-400/45" />
                      )}
                      <ChevronDown
                        size={12}
                        className={`text-white/40 transition-transform duration-200 ${expandedDocId === doc.id ? 'rotate-180' : ''}`}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id, doc.filename);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/[0.08] text-white/35 hover:text-red-400/65"
                        title="Remove document"
                        aria-label={`Remove ${doc.filename}`}
                      >
                        <X size={10} />
                      </button>
                      {doc.status === 'ready' && (
                        <button
                          onClick={(e) => handleReuploadClick(e, doc)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/[0.08] text-white/35 hover:text-purple-400/75"
                          title="Re-upload document"
                          aria-label={`Re-upload ${doc.filename}`}
                        >
                          <RefreshCw size={10} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded info panel */}
                  <AnimatePresence>
                    {expandedDocId === doc.id && (
                      <DocumentInfoPanel
                        doc={doc}
                        detail={docDetails[doc.id] || null}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
