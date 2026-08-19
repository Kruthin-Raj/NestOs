import { useState, useEffect } from 'react'
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DocumentViewerModalProps {
  isOpen: boolean
  onClose: () => void
  blobUrl: string | null
  mimeType: string
  fileName?: string | null
  documentType: string
  onDownload?: () => void
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  blobUrl,
  mimeType,
  fileName,
  documentType,
  onDownload,
}: DocumentViewerModalProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  // Declared before the effect that calls them — hoisting only works for
  // function declarations, and these are consts. No useCallback: the React
  // Compiler memoizes them, and hand-written useCallback here defeated it.
  function handleZoomIn() {
    setScale((prev) => Math.min(prev + 0.25, 3.5))
  }

  function handleZoomOut() {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
  }

  function handleResetZoom() {
    setScale(1)
    setRotation(0)
  }

  function handleRotate() {
    setRotation((prev) => (prev + 90) % 360)
  }

  // Esc closes; +/- zoom; r rotates.
  //
  // The state reset that used to live here is gone: document-row now mounts
  // this component only while it is open, so every open starts from the
  // useState defaults without an effect writing state during render.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn()
      } else if (e.key === '-') {
        handleZoomOut()
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotate()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handleZoomIn, handleZoomOut, handleRotate])

  if (!isOpen || !blobUrl) return null

  const isImage =
    mimeType.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(fileName || '')

  const isPdf =
    mimeType === 'application/pdf' ||
    /\.pdf$/i.test(fileName || '')

  const formattedDocType = documentType.replace(/_/g, ' ')

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-all duration-300 ${
          isFullscreen
            ? 'w-full h-full max-w-none max-h-none rounded-none'
            : 'w-full max-w-5xl h-[88vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <FileText className="h-5 w-5 flex-shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 capitalize truncate">
                  {formattedDocType}
                </h3>
                <Badge variant="default" className="text-xs uppercase tracking-wider font-mono">
                  {isPdf ? 'PDF' : isImage ? 'Image' : 'Document'}
                </Badge>
              </div>
              {fileName && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs sm:max-w-md">
                  {fileName}
                </p>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isImage && (
              <div className="hidden sm:flex items-center bg-gray-200/70 dark:bg-gray-800 rounded-lg p-0.5 mr-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="Zoom out (-)"
                  className="p-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded hover:bg-white dark:hover:bg-gray-700 transition"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  title="Reset zoom"
                  className="px-2 py-1 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded transition"
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Zoom in (+)"
                  className="p-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded hover:bg-white dark:hover:bg-gray-700 transition"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
                <button
                  type="button"
                  onClick={handleRotate}
                  title="Rotate 90° (R)"
                  className="p-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded hover:bg-white dark:hover:bg-gray-700 transition"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => window.open(blobUrl, '_blank')}
              title="Open in new window"
              className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 rounded-lg transition"
            >
              <ExternalLink className="h-4 w-4" />
            </button>

            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                title="Download original file"
                className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <Download className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="hidden sm:inline-flex p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 rounded-lg transition"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-2 sm:p-6 relative select-none">
          {isImage ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 dark:bg-gray-950/80 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                </div>
              )}
              <img
                src={blobUrl}
                alt={formattedDocType}
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md pointer-events-auto"
                draggable={false}
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={`${blobUrl}#toolbar=1&navpanes=0`}
              title={formattedDocType}
              className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-gray-900 rounded-xl shadow border border-gray-200 dark:border-gray-800 max-w-md">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-3" />
              <h4 className="text-base font-medium text-gray-900 dark:text-gray-100">
                Preview not directly supported for this format
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                File type: {mimeType || 'Unknown'}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => window.open(blobUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Open in New Tab
                </Button>
                {onDownload && (
                  <Button size="sm" variant="outline" onClick={onDownload}>
                    <Download className="h-4 w-4 mr-1.5" /> Download
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
