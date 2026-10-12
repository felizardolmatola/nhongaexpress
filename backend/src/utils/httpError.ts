/**
 * utils/httpError.ts — erro com código HTTP. Os serviços lançam-no e o
 * middleware `errorHandler` converte-o numa resposta JSON limpa.
 */
export class HttpError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}
