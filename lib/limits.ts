export const MAX_RESUME_CHARS = 100_000;
export const MAX_JOB_CHARS = 50_000;
// Vercel Functions reject request bodies over 4.5 MB; keep the whole
// multipart request (file + MAX_UPLOAD_BYTES overhead) below that.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_LABEL = "4 MB";
export const MAX_UPLOAD_BYTES = MAX_FILE_BYTES + 64 * 1024;
export const MAX_PDF_PAGES = 20;
export const PDF_TIMEOUT_MS = 10_000;
