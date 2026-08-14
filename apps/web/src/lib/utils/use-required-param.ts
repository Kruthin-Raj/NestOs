import { useParams } from 'react-router-dom'

/**
 * Reads a route parameter that the matching <Route path> guarantees exists.
 *
 * useParams() is typed `string | undefined` because React Router cannot know
 * which route matched at compile time. Throwing on a missing value surfaces a
 * genuine routing mistake — a renamed path segment, a typo'd key — instead of
 * quietly issuing an API request for `undefined`.
 */
export function useRequiredParam(name: string): string {
  const params = useParams()
  const value = params[name]

  if (value === undefined) {
    throw new Error(
      `Missing route parameter "${name}". Check the <Route path> in App.tsx ` +
        `that renders this page — the segment name must match.`
    )
  }

  return value
}
