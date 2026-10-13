/** Local test routing only; each real Worker still enforces its own authentication. */
export default {
  fetch(request: Request, env: { GAME: { fetch(request: Request): Promise<Response> }; ADMIN: { fetch(request: Request): Promise<Response> } }): Promise<Response> {
    return (request.headers.get('x-uomd-e2e-admin') === '1' || new URL(request.url).pathname.startsWith('/admin') ? env.ADMIN : env.GAME).fetch(request);
  }
};
