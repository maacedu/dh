import { handleExtractDocumentRequest } from '../../server/core';

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método não permitido.' }, { status: 405 });
  }

  try {
    const body = (await req.json()) as {
      fileBase64?: string;
      mimeType?: string;
      fileName?: string;
      hintTipoDocumento?: string;
    };

    const result = await handleExtractDocumentRequest({
      sessionToken: req.headers.get('x-session-token'),
      authHeader: req.headers.get('authorization'),
      body: body || {},
    });

    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json(
      { error: 'Não foi possível processar o arquivo enviado.' },
      { status: 400 }
    );
  }
};
