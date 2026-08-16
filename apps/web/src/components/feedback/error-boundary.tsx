import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render errors so a single bad field does not blank the whole app.
 *
 * Without this, something as small as a missing nested relation (an API that
 * returns a booking without its room, say) throws during render and React
 * unmounts everything — leaving a white page and no clue what happened.
 *
 * Class component because there is still no hook equivalent for this.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in the console rather than sent anywhere — the message can contain
    // whatever the page was rendering, which may include tenant data.
    console.error('Render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white dark:bg-gray-50 p-6 text-center">
          <p className="text-lg font-semibold text-gray-900">Something broke on this page</p>
          <p className="mt-1 text-sm text-gray-500">
            The rest of the app is fine. Reload, or head back and try again.
          </p>

          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-gray-900 dark:bg-gray-100 p-3 text-left text-xs text-gray-100 dark:text-gray-900">
              {this.state.error.message}
            </pre>
          )}

          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Reload
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
