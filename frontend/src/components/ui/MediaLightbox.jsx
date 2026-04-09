import { useEffect } from 'react'
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'

export default function MediaLightbox({ url, type, onClose }) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] lightbox-overlay flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {type === 'image' && (
          <>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </>
        )}
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white transition-colors"
        >
          <Download className="w-4 h-4" />
        </a>
        <button
          onClick={onClose}
          className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-w-5xl max-h-[90vh] overflow-auto flex items-center justify-center animate-scale-in">
        {type === 'image' ? (
          <img
            src={url}
            alt="Media"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease' }}
          />
        ) : type === 'video' ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
          />
        ) : null}
      </div>
    </div>
  )
}
