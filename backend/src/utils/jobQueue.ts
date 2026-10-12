/**
 * utils/jobQueue.ts — fila de tarefas em SEGUNDO PLANO (em memória).
 *
 * `enqueue()` devolve na hora: a resposta HTTP (ex.: checkout) NÃO espera pela tarefa.
 * Cada tarefa corre depois, com concorrência limitada e novas tentativas com espera
 * crescente se falhar (ex.: servidor SMTP temporariamente em baixo).
 *
 * Limite conhecido: a fila vive na memória do processo. Se o servidor reiniciar com tarefas
 * pendentes, essas tarefas perdem-se. Para garantia total, trocar por uma fila persistente
 * (BullMQ/Redis, ou uma tabela `jobs` no Supabase) mantendo a mesma função `enqueue`.
 */
type Job = { name: string; run: () => Promise<void>; attempt: number };

const MAX_CONCURRENT = 2;
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000]; // 3 novas tentativas depois da 1.ª falha

const waiting: Job[] = [];
let running = 0;
let pendingTimers = 0;

const pump = () => {
  while (running < MAX_CONCURRENT && waiting.length > 0) {
    const job = waiting.shift()!;
    running++;
    job
      .run()
      .catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        const delay = RETRY_DELAYS_MS[job.attempt];
        if (delay === undefined) {
          console.error(`[jobs] "${job.name}" falhou definitivamente: ${reason}`);
          return;
        }
        console.error(`[jobs] "${job.name}" falhou (${reason}); nova tentativa em ${delay / 1000}s.`);
        pendingTimers++;
        setTimeout(() => {
          pendingTimers--;
          waiting.push({ ...job, attempt: job.attempt + 1 });
          pump();
        }, delay).unref(); // não impede o processo de terminar
      })
      .finally(() => {
        running--;
        pump();
      });
  }
};

/** Agenda a tarefa e devolve imediatamente. Nunca lança erro para quem chama. */
export const enqueue = (name: string, run: () => Promise<void>): void => {
  waiting.push({ name, run, attempt: 0 });
  // setImmediate: a tarefa só começa depois de a resposta HTTP já ter sido entregue ao event loop.
  setImmediate(pump);
};

/** Espera (até `timeoutMs`) que as tarefas em curso acabem — usado no encerramento do servidor. */
export const drainJobs = async (timeoutMs = 10_000): Promise<void> => {
  const end = Date.now() + timeoutMs;
  while ((running > 0 || waiting.length > 0 || pendingTimers > 0) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 100));
  }
};
