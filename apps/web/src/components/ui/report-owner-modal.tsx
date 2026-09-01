import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: { reportedUserId: string; reason: string }) =>
      apiClient.post('/reports', payload),
    onSuccess: () => {
      onClose()
      setReason('')
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
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onClose()
              setReason('')
            }}
          >
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={reason.trim().length < 10 || isPending}
            onClick={() => mutate({ reportedUserId: ownerId, reason: reason.trim() })}
          >
            {isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </div>
    </div>
  )
}
