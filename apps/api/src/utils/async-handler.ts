import { Request, Response, NextFunction, RequestHandler } from 'express'

/** Express's own default for route params — a param can repeat, hence the array. */
type ParamsDictionary = Record<string, string | string[]>

/**
 * Wraps an async route handler so a rejected promise reaches the global error
 * handler instead of hanging the request.
 *
 * Express 5 forwards rejections from async handlers on its own, but going
 * through this wrapper keeps the behaviour explicit and identical to the
 * try/catch + next(err) that every controller used to repeat by hand.
 *
 * The optional P generic names the route parameters. Express types params as
 * `string | string[]` because a param can repeat, so declaring them — e.g.
 * `asyncHandler<{ buildingId: string }>(...)` — is what makes
 * `req.params.buildingId` a plain string at the call site.
 */
export function asyncHandler<P = ParamsDictionary>(
  fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler<P> {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
