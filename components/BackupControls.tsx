"use client";
import { useState } from "react";
import { exportBackup, exportPreviousBackup, importBackup, useStorageWarning } from "@/lib/storage";

export default function BackupControls() {
  const warning = useStorageWarning();
  const [message, setMessage] = useState("");
  function download(previous = false) {
    try {
      const url = URL.createObjectURL(new Blob([previous ? exportPreviousBackup() : exportBackup()], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "aca-backup.json"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Backup exported. Keep it private: it contains your resume and contact details.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export failed"); }
  }
  return <details className="bookmarklet-card"><summary>Backups and storage</summary>
    <p>Data stays in this browser. Export a private backup to move devices or recover your records. Import merges applications and replaces the profile; an automatic pre-import snapshot is retained.</p>
    {warning && <p role="alert">{warning}</p>}
    <button className="secondary-btn" onClick={() => download()}>Export backup</button>
    <button className="secondary-btn" onClick={() => download(true)}>Export pre-import backup</button>
    <label className="field-label">Import backup<input type="file" accept="application/json,.json" onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = "";
      if (!file) return;
      if (file.size > 10_000_000) { setMessage("Backup is too large"); return; }
      if (!window.confirm("Merge applications and replace the profile from this backup?")) return;
      try { await importBackup(await file.text()); setMessage("Backup imported."); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Import failed"); }
    }} /></label>
    {message && <p role="status">{message}</p>}
  </details>;
}
