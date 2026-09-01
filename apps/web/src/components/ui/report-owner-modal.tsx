import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Image as ImageIcon } from 'lucide-react'
import { Button } from './button'
import { showToast } from './toaster'
import apiClient from '@/lib/api/client'

export function ReportOwnerModal({
  ownerId,
  isOpen,
  onClose,
}: {
  ownerId: string
  isOpen: boolean
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: { reportedUserId: string; reason: string; attachments: string[] }) =>
      apiClient.post('/reports', payload),
    onSuccess: () => {
      onClose()
      setReason('')
      setFiles([])
      showToast('Owner reported successfully', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Failed to submit report', 'error')
    },
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Report Owner</h3>
        <p className="text-sm text-gray-500 mb-4">
          Please describe why you are reporting this owner. False reports may result in account suspension.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Minimum 10 characters..."
          className="w-full h-32 p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none mb-4"
        />

        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 2 || isUploading || isPending}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Attach Photo
            </Button>
            <span className="text-xs text-gray-500">Max 2 files, 2MB each</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (!e.target.files) return
                const selected = Array.from(e.target.files)
                if (files.length + selected.length > 2) {
                  showToast('Maximum 2 attachments allowed', 'error')
                  return
                }
                const validFiles = selected.filter(f => {
                  if (f.size > 2 * 1024 * 1024) {
                    showToast(`${f.name} exceeds 2MB limit`, 'error')
                    return false
                  }
                  return true
                })
                setFiles(prev => [...prev, ...validFiles].slice(0, 2))
                // Reset input value so same file can be selected again if removed
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              disabled={files.length >= 2 || isUploading || isPending}
            />
          </div>
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 border rounded text-sm">
                  <span className="truncate flex-1 pr-2">{file.name}</span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500"
                    onClick={() => setFiles(f => f.filter((_, idx) => idx !== i))}
                    disabled={isUploading || isPending}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onClose()
              setReason('')
              setFiles([])
            }}
          >
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={reason.trim().length < 10 || isPending || isUploading}
            onClick={async () => {
              const trimmed = reason.trim()
              if (trimmed.length < 10) return

              setIsUploading(true)
              try {
                const attachments: string[] = []
                for (const file of files) {
                  const { data: presigned } = await apiClient.post('/uploads/presigned-url', {
                    documentType:  'OTHER',
                    fileName:      file.name,
                    mimeType:      file.type,
                    fileSizeBytes: file.size,
                  })
                  
                  const put = await fetch(presigned.data.uploadUrl, {
                    method:  'PUT',
                    body:    file,
                    headers: { 'Content-Type': file.type },
                  })
                  if (!put.ok) throw new Error(`Failed to upload ${file.name}`)
                  
                  const { data: docRes } = await apiClient.post('/uploads/confirm', {
                    fileKey:       presigned.data.fileKey,
                    documentType:  'OTHER',
                    fileName:      file.name,
                    fileSizeBytes: file.size,
                    mimeType:      file.type,
                  })
                  attachments.push(docRes.data.id)
                }
                
                mutate({ reportedUserId: ownerId, reason: trimmed, attachments })
              } catch (err) {
                console.error(err)
                showToast('Failed to upload attachments', 'error')
              } finally {
                setIsUploading(false)
              }
            }}
          >
            {isUploading ? 'Uploading...' : isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </div>
    </div>
  )
}
