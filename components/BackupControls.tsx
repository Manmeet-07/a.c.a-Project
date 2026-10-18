"use client";
import { useState } from "react";
import { exportBackup, exportPreviousBackup, importBackup, importLegacyBrowserData, hasLegacyBrowserData, useStorageWarning } from "@/lib/storage";

export default function BackupControls() {
  const warning = useStorageWarning();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function download(previous = false) {
    try {
      const url = URL.createObjectURL(new Blob([previous ? exportPreviousBackup() : exportBackup()], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "aca-backup.json"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Backup exported. Keep it private: it contains your resume and contact details.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export failed"); }
  }
  return (
    <>
      {warning && <p className="notice notice-warning" role="alert">{warning}</p>}
      <details className="footer-disclosure">
        <summary>Backups and data</summary>
        <p className="muted">Your data syncs to your account. Export a private backup to keep a copy. Importing merges applications and replaces the profile; a recovery snapshot is available until you sign out or reload.</p>
        {hasLegacyBrowserData() && <button className="btn btn-secondary" disabled={busy} onClick={async () => {
          if (!window.confirm("Import the previous data saved in this browser into your signed-in account? Only do this on your own device. Your original browser data will be preserved.")) return;
          setBusy(true);
          try { await importLegacyBrowserData(); setMessage("Previous browser data imported into your account."); }
          catch (error) { setMessage(error instanceof Error ? error.message : "Import failed"); }
          finally { setBusy(false); }
        }}>Import previous browser data</button>}
        <div className="button-row">
          <button type="button" className="btn btn-secondary" onClick={() => download()}>Export backup</button>
          <button type="button" className="btn btn-secondary" onClick={() => download(true)}>Export pre-import backup</button>
          <label className="btn btn-secondary file-button">Import backup<input className="file-input" type="file" accept="application/json,.json" aria-label="Import backup" onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = "";
            if (!file) return;
            if (file.size > 10_000_000) { setMessage("Backup is too large"); return; }
            if (!window.confirm("Merge applications and replace the profile from this backup?")) return;
            try { await importBackup(await file.text()); setMessage("Backup imported."); }
            catch (error) { setMessage(error instanceof Error ? error.message : "Import failed"); }
          }} /></label>
        </div>
        {message && <p className="muted" role="status">{message}</p>}
      </details>
    </>
  );
}
