import { handleLoginRequest } from '../../server/core';

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método não permitido.' }, { status: 405 });
  }

  try {
    const body = (await req.json()) as { password?: string };
    const result = handleLoginRequest(body?.password);
    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json({ error: 'Requisição inválida.' }, { status: 400 });
  }
};
