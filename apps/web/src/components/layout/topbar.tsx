import { Menu } from 'lucide-react'
import { useUIStore } from '@/store/ui.store'

export function Topbar() {
  const { toggleSidebar } = useUIStore()

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-3 lg:hidden">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
          <span className="text-white font-bold text-xs">N</span>
        </div>
        <span className="font-semibold text-gray-900 text-sm">NestOS</span>
      </div>
    </header>
  )
}