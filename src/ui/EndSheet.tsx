import type { DailyStats } from "../api/client";
import { MAX_ROUND_SCORE, MAX_RUN_SCORE, roundScore, runTotal } from "../game/scoring";
import type { Run } from "../game/types";
import { useI18n } from "../i18n/i18n";

interface Props {
  run: Run;
  modeLabel: string;
  previousBest: number;
  daily: DailyStats | null;
  mobile: boolean;
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

export function EndSheet({ run, modeLabel, previousBest, daily, mobile, onShare, onAgain, onHistory, onHome }: Props) {
  const { t, num } = useI18n();
  const total = run.total ?? runTotal(run);
  const showDaily = run.mode === "daily" && daily && daily.players > 0;
  const lines: string[] = [];
  if (showDaily) lines.push(rankLine(daily, t));
  if (previousBest > 0 && total > previousBest) lines.push(t("personalBest", { score: num(previousBest) }));
  return (
    <div className="screen end-screen" role="dialog" aria-labelledby="end-title">
      <header className="top end" data-inset={mobile ? undefined : "top"}>
        <div className="band">
          <div className="brand">
            <b className="desk-only">{t("appName")}</b>
            <span>{modeLabel}</span>
          </div>
          <div className="question">
            <span className="label">{t("result")}</span>
            <h1 id="end-title">
              <span data-testid="end-score">{num(total)}</span>{" "}
              <span className="out-of">{t("outOf", { max: num(MAX_RUN_SCORE) })}</span>
            </h1>
          </div>
          <div className="side">
            <button type="button" className="link" onClick={onHome}>
              {t("home")}
            </button>
          </div>
        </div>
        <div className="strip">
          <div className="links desk-only">
            <button type="button" className="link" onClick={onHistory}>
              {t("myRuns")}
            </button>
          </div>
          <p className="hint" data-testid="daily-rank">
            {lines.join(" ")}
          </p>
        </div>
      </header>
      <div className="panel end-panel" data-inset={mobile ? undefined : "left"}>
        <section className="sec">
          <table className="tbl rounds">
            <thead>
              <tr>
                <th />
                <th>{t("colStation")}</th>
                <th>{t("colGuesses")}</th>
                <th className="num">{t("colPoints")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {run.rounds.map((r, i) => {
                const score = roundScore(r);
                return (
                  <tr key={r.code}>
                    <td className="n">{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.outcome === "found" ? r.guesses.length : t("gaveUp")}</td>
                    <td className="num pt">{num(score)}</td>
                    <td className="bar" aria-hidden="true">
                      <i style={{ width: `${(score / MAX_ROUND_SCORE) * 100}%` }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        {showDaily && (
          <section className="sec">
            <Histogram daily={daily} total={total} />
          </section>
        )}
        <section className="sec actions">
          <button type="button" className="btn" onClick={onAgain}>
            {t(run.mode === "daily" ? "againAfterDaily" : "againFree")} <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="btn line" onClick={onShare}>
            {t("share")}
          </button>
          <p className="note">{t("shareNote")}</p>
          <button type="button" className="link phone-only" onClick={onHistory}>
            {t("myRuns")}
          </button>
        </section>
      </div>
    </div>
  );
}

function rankLine(daily: DailyStats, t: ReturnType<typeof useI18n>["t"]): string {
  if (daily.players <= 1) return t("dailyFirst");
  const pct = daily.percentile ?? 0;
  if (pct > 0) return t("dailyRank", { pct, n: daily.players });
  // "Better than 0%" reads oddly, so say it plainly.
  return daily.players === 2 ? t("dailyRankLastOne") : t("dailyRankLast", { n: daily.players - 1 });
}

function Histogram({ daily, total }: { daily: DailyStats; total: number }) {
  const { t, num } = useI18n();
  const max = Math.max(...daily.histogram, 1);
  const bucketSize = MAX_RUN_SCORE / daily.histogram.length;
  const mine = Math.min(daily.histogram.length - 1, Math.floor(total / bucketSize));
  return (
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
        <span className="avg" style={{ left: `${(daily.average / MAX_RUN_SCORE) * 100}%` }} />
      </div>
      <figcaption>
        <span>0</span>
        <span>{t("dailyAverage", { score: num(daily.average) })}</span>
        <span>{num(MAX_RUN_SCORE)}</span>
      </figcaption>
    </figure>
  );
}
