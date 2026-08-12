import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-semibold text-gray-900">404</p>
      <p className="text-gray-500">We couldn&apos;t find that page.</p>
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:underline">
        Back to home
      </Link>
    </div>
  )
}
