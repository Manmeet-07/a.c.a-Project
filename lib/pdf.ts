import { Worker } from "node:worker_threads";
import path from "node:path";
import { RequestError } from "./http";
import { PDF_TIMEOUT_MS } from "./limits";

let active = 0;
export async function parsePdf(buffer: Buffer): Promise<string[]> {
  if (active >= 2) throw new RequestError(503, "Resume parser is busy. Please try again shortly.");
  active++;
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<string[]>((resolve, reject) => {
      worker = new Worker(path.join(process.cwd(), "workers/pdf.cjs"), {
        workerData: buffer,
        resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
        stdout: true, stderr: true,
      });
      // Drain parser diagnostics without exposing resume data or stack traces.
      worker.stdout?.resume(); worker.stderr?.resume();
      worker.once("message", message => {
        if (message.error) reject(new RequestError(422, message.error));
        else resolve(message.lines);
      });
      worker.once("error", () => reject(new RequestError(422, "PDF exceeded parser resources or could not be read")));
      worker.once("exit", () => reject(new RequestError(422, "PDF parser stopped before completing")));
      timer = setTimeout(() => reject(new RequestError(503, "PDF parsing timed out. Try a shorter PDF.")), PDF_TIMEOUT_MS);
    });
  } finally {
    clearTimeout(timer);
    if (worker) { worker.removeAllListeners(); await worker.terminate(); }
    active--;
  }
}
