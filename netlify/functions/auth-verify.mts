import { verifySessionToken } from '../../server/core';

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  const token = req.headers.get('x-session-token');
  if (!verifySessionToken(token)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return Response.json({ ok: true }, { status: 200 });
};
