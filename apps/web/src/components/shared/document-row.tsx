import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'

export interface ReviewDocument {
  id: string
  documentType: string
  fileName?: string | null
  status?: string
}

/**
 * One uploaded document in an admin review list.
 *
 * Documents are behind an authorized endpoint rather than a public URL, so the
 * file is fetched with the session cookie and handed to the browser as a blob —
 * a plain <a href> would not carry credentials cross-origin.
 */
export function DocumentRow({ doc }: { doc: ReviewDocument }) {
  const [downloading, setDownloading] = useState(false)

  async function openDocument() {
    setDownloading(true)
    try {
      const { data } = await apiClient.get(`/uploads/documents/${doc.id}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.fileName ?? doc.documentType
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Could not open that document', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-gray-800 truncate">
            {doc.documentType.replace(/_/g, ' ')}
          </p>
          {doc.fileName && (
            <p className="text-xs text-gray-400 truncate">{doc.fileName}</p>
          )}
        </div>
      </div>
      <Button size="sm" variant="ghost" loading={downloading} onClick={openDocument}>
        <Download className="h-4 w-4 mr-1" /> Open
      </Button>
    </div>
  )
}
