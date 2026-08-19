import { useState } from 'react'
import { FileText, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { DocumentViewerModal } from './document-viewer-modal'

export interface ReviewDocument {
  id: string
  documentType: string
  fileName?: string | null
  status?: string
}

/**
 * One uploaded document in an admin review list.
 *
 * Documents are behind an authorized endpoint rather than a public URL.
 * When clicked, the document is fetched with session credentials and previewed
 * directly inside an in-app viewer modal without forcing a download.
 */
export function DocumentRow({ doc }: { doc: ReviewDocument }) {
  const [loading, setLoading] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string>('')

  async function handleViewDocument() {
    // If already loaded and active, just open modal
    if (previewBlobUrl) {
      setIsViewerOpen(true)
      return
    }

    setLoading(true)
    try {
      const response = await apiClient.get(`/uploads/documents/${doc.id}`, {
        responseType: 'blob',
      })

      const blob = response.data as Blob
      const type = blob.type || 'application/octet-stream'
      const url = URL.createObjectURL(blob)

      setMimeType(type)
      setPreviewBlobUrl(url)
      setIsViewerOpen(true)
    } catch {
      showToast('Could not load document preview', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleCloseViewer() {
    setIsViewerOpen(false)
  }

  function handleDownload() {
    if (!previewBlobUrl) return
    const a = document.createElement('a')
    a.href = previewBlobUrl
    a.download = doc.fileName ?? doc.documentType
    a.click()
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:bg-gray-50/70 dark:hover:bg-gray-800/50 px-3 py-2 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <FileText className="h-4 w-4 flex-shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize truncate">
              {doc.documentType.replace(/_/g, ' ')}
            </p>
            {doc.fileName && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{doc.fileName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            loading={loading}
            onClick={handleViewDocument}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/60"
          >
            <Eye className="h-3.5 w-3.5 mr-1" /> View
          </Button>
        </div>
      </div>

      {/* Mounted only while open, so zoom and rotation reset themselves the
          next time it opens — the modal used to do that in an effect. */}
      {isViewerOpen && (
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={handleCloseViewer}
        blobUrl={previewBlobUrl}
        mimeType={mimeType}
        fileName={doc.fileName}
        documentType={doc.documentType}
        onDownload={handleDownload}
      />
      )}
    </>
  )
}
