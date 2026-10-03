import { useEffect, useRef, useState } from "react";
import { dateKeyFor } from "../game/dates";
import { roundScore, runTotal } from "../game/scoring";
import type { Run } from "../game/types";
import { useI18n } from "../i18n/i18n";
import { exportPayload, parseExport } from "../storage/backup";
import type { RunRepo } from "../storage/repo";
import { playerStats } from "../storage/stats";

interface Props {
  repo: RunRepo;
  /** Bumped by the app whenever runs change, here or in another tab. */
  version: number;
  onClose: () => void;
  onToast: (text: string) => void;
}

export function HistoryDrawer({ repo, version, onClose, onToast }: Props) {
  const { t, num, locale } = useI18n();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [note, setNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version and reload are refresh triggers
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await repo.list();
      if (cancelled) return;
      const visible = list.runs.filter((r) => r.status !== "abandoned");
      setRuns(visible);
      setSkipped(list.skipped);
      const parts: string[] = [];
      if (repo.kind === "memory") parts.push(t("storageMemory"));
      else {
        const kb = Math.round(new Blob([JSON.stringify(list.runs)]).size / 102.4) / 10;
        parts.push(t(visible.length === 1 ? "storageSizeOne" : "storageSize", { n: visible.length, kb }));
        const persisted = await navigator.storage?.persisted?.().catch(() => false);
        parts.push(t(persisted ? "storagePersistent" : "storageBestEffort"));
      }
      if (!cancelled) setNote(parts.join(" "));
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, version, reload, t]);

  const stats = runs ? playerStats(runs, dateKeyFor()) : null;

  async function doExport() {
    const { runs: all } = await repo.list();
    const blob = new Blob([JSON.stringify(exportPayload(all), null, 1)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `ovguesser-${dateKeyFor()}.json`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    await repo.setMeta("lastExportAt", Date.now());
  }

  async function doImport(file: File) {
    try {
      const { imported, skipped: bad } = await repo.importRuns(parseExport(await file.text()));
      onToast(
        bad
          ? t("importedSkipped", { n: imported, skipped: bad })
          : t(imported === 1 ? "importedOne" : "imported", { n: imported }),
      );
      setReload((n) => n + 1);
    } catch {
      onToast(t("importFailed"));
    }
  }

  async function doWipe() {
    if (!confirm(t("wipeConfirm"))) return;
    await repo.clear();
    onToast(t("wiped"));
    setReload((n) => n + 1);
  }

  const tag = (r: Run) =>
    r.mode === "daily" ? t("tagDaily") : r.pool === "intercity" ? t("tagIntercity") : t("tagFree");

  return (
    <aside className="drawer" aria-label={t("myRuns")}>
      <header className="band">
        <h2>{t("myRuns")}</h2>
        <button ref={closeButton} type="button" className="link" onClick={onClose}>
          {t("close")}
        </button>
      </header>
      <div className="body">
        {stats && (
          <div className="stats">
            {(
              [
                ["statRuns", num(stats.finished)],
                ["statAverage", num(stats.average)],
                ["statBest", num(stats.best)],
                ["statStreak", num(stats.dailyStreak)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="stat">
                <span>{t(k)}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
        )}
        {stats && stats.hardest.length > 0 && (
          <>
            <h3>{t("hardest")}</h3>
            <table className="tbl">
              <tbody>
                {stats.hardest.map((s) => (
                  <tr key={s.code}>
                    <td>{s.name}</td>
                    <td className="soft">{t("hardestPlays", { n: s.plays })}</td>
                    <td className="num pt">{t("hardestAverage", { score: num(s.average) })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <h3>{t("allRuns")}</h3>
        {runs && runs.length === 0 && <p className="soft">{t("noRuns")}</p>}
        {runs?.map((r) => (
          <details key={r.id} className="run">
            <summary>
              <span className="when">
                {new Date(r.startedAt).toLocaleString(locale, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span>
                {tag(r)}
                {r.status === "active" && <span className="soft"> · {t("inProgress")}</span>}
              </span>
              <b>{num(r.total ?? runTotal(r))}</b>
            </summary>
            <table className="tbl detail">
              <tbody>
                {r.rounds.map((x, i) => (
                  <tr key={x.code}>
                    <td className="n">{i + 1}</td>
                    <td>{x.name}</td>
                    <td className="soft">
                      {x.outcome === "found" ? x.guesses.length : x.outcome === "revealed" ? t("gaveUp") : ""}
                    </td>
                    <td className="num">{x.outcome ? num(roundScore(x)) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
        {skipped > 0 && <p className="soft small">{t("skippedRecords", { n: skipped })}</p>}
        <div className="data-actions">
          <button type="button" className="link" onClick={doExport}>
            {t("export")}
          </button>
          <button type="button" className="link" onClick={() => fileInput.current?.click()}>
            {t("import")}
          </button>
          <button type="button" className="link" onClick={doWipe}>
            {t("wipe")}
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void doImport(file);
          }}
        />
        <p className="storage-note">{note}</p>
        <p className="storage-note">{t("privacy")}</p>
      </div>
    </aside>
  );
}
