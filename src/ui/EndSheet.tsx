import type { DailyStats } from "../api/client";
import { MAX_RUN_SCORE, roundScore, roundSquare, runTotal } from "../game/scoring";
import type { Run } from "../game/types";
import { useI18n } from "../i18n/i18n";

interface Props {
  run: Run;
  previousBest: number;
  daily: DailyStats | null;
  onShare: () => void;
  onAgain: () => void;
  onHistory: () => void;
  onHome: () => void;
}

export function formatDateKey(dateKey: string, locale: string) {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function EndSheet({ run, previousBest, daily, onShare, onAgain, onHistory, onHome }: Props) {
  const { t, num, locale } = useI18n();
  const total = run.total ?? runTotal(run);
  const label =
    run.mode === "daily"
      ? t("dailyLabel", { date: formatDateKey(run.dateKey, locale) })
      : t(run.pool === "intercity" ? "intercityLabel" : "freePlayLabel");
  return (
    <div className="overlay show">
      <div className="sheet" role="dialog" aria-labelledby="end-title">
        <div className="sheet-head">
          <p className="sub tight">{label}</p>
          <button type="button" className="btn btn-ghost icon" onClick={onHome} aria-label={t("close")}>
            ✕
          </button>
        </div>
        <h2 id="end-title">
          <span className="big-score" data-testid="end-score">
            {num(total)}
          </span>{" "}
          <span className="out-of">/ {num(MAX_RUN_SCORE)}</span>
        </h2>
        {previousBest > 0 && total > previousBest && (
          <p>
            <span className="badge">{t("personalBest")}</span>{" "}
            <small className="soft">{t("previousBest", { score: num(previousBest) })}</small>
          </p>
        )}
        <table className="rounds">
          <tbody>
            {run.rounds.map((r) => (
              <tr key={r.code}>
                <td>
                  <span aria-hidden="true">{roundSquare(r)}</span> {r.name}
                </td>
                <td className="muted">{r.outcome === "found" ? `${r.guesses.length}×` : t("gaveUp")}</td>
                <td className="num">{num(roundScore(r))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {run.mode === "daily" && daily && daily.players > 0 && <DailyPanel daily={daily} total={total} />}
        <div className="stack">
          <button type="button" className="btn btn-yellow" onClick={onShare}>
            {t("share")}
          </button>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={onAgain}>
              {t("again")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onHistory}>
              {t("myRuns")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DailyPanel({ daily, total }: { daily: DailyStats; total: number }) {
  const { t, num } = useI18n();
  const max = Math.max(...daily.histogram, 1);
  const bucketSize = MAX_RUN_SCORE / daily.histogram.length;
  const mine = Math.min(daily.histogram.length - 1, Math.floor(total / bucketSize));
  return (
    <div className="daily-panel">
      <p className="daily-rank" data-testid="daily-rank">
        {daily.players <= 1 ? t("dailyFirst") : t("dailyRank", { pct: daily.percentile ?? 0, n: daily.players })}
      </p>
      <figure className="histogram" aria-label={t("scoreDistribution")}>
        <div className="bars">
          {daily.histogram.map((n, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed score buckets
              key={i}
              className={`bar${i === mine ? " mine" : ""}`}
              style={{ height: `${Math.max(n ? 8 : 2, (n / max) * 100)}%` }}
              title={`${num(i * bucketSize)}–${num((i + 1) * bucketSize)}: ${n}`}
            >
              {i === mine && <span className="you">{t("you")}</span>}
            </div>
          ))}
        </div>
        <figcaption>
          <span>0</span>
          <span>{t("dailyAverage", { score: num(daily.average) })}</span>
          <span>{num(MAX_RUN_SCORE)}</span>
        </figcaption>
      </figure>
    </div>
  );
}
