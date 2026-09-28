import { runTotal } from "../game/scoring";
import { STATIONS, stationPool } from "../game/stations";
import type { Pool, Run } from "../game/types";
import { useI18n } from "../i18n/i18n";
import { LangToggle } from "./LangToggle";

interface Props {
  active: Run | undefined;
  dailyDone: Run | undefined;
  pool: Pool;
  playersToday: number | null;
  memoryOnly: boolean;
  onPool: (pool: Pool) => void;
  onDaily: () => void;
  onFree: () => void;
  onResume: (run: Run) => void;
  onHistory: () => void;
}

export function StartSheet(p: Props) {
  const { t, num } = useI18n();
  return (
    <div className="overlay show">
      <div className="sheet" role="dialog" aria-labelledby="start-title">
        <div className="sheet-head">
          <h1 id="start-title">{t("appName")}</h1>
          <LangToggle />
        </div>
        <p className="sub">{t("tagline")}</p>
        {p.memoryOnly && <p className="warning">{t("memoryWarning")}</p>}
        {p.active && (
          <div className="resume">
            <span>{t("resumeTitle", { round: p.active.current + 1, score: num(runTotal(p.active)) })}</span>
            <button type="button" className="btn btn-primary small" onClick={() => p.active && p.onResume(p.active)}>
              {t("resume")}
            </button>
          </div>
        )}
        <div className="stack">
          <button type="button" className="btn btn-primary" onClick={p.onDaily}>
            {t("daily")}{" "}
            <span className="soft">
              ·{" "}
              {p.dailyDone
                ? t("dailyPlayed", { score: num(p.dailyDone.total ?? runTotal(p.dailyDone)) })
                : t("dailyNew")}
            </span>
          </button>
          <button type="button" className="btn btn-yellow" onClick={p.onFree}>
            {t("freePlay")}
          </button>
        </div>
        <div className="label">{t("stations")}</div>
        <div className="seg">
          {(["all", "intercity"] as const).map((pool) => (
            <button key={pool} type="button" aria-pressed={p.pool === pool} onClick={() => p.onPool(pool)}>
              {t(pool === "all" ? "poolAll" : "poolIntercity", {
                n: pool === "all" ? STATIONS.length : stationPool(pool).length,
              })}
            </button>
          ))}
        </div>
        {p.playersToday !== null && p.playersToday > 0 && (
          <p className="players-today">
            {p.playersToday === 1 ? t("playersTodayOne") : t("playersToday", { n: p.playersToday })}
          </p>
        )}
        <div className="sheet-foot">
          <button type="button" className="btn-link" onClick={p.onHistory}>
            {t("myRuns")}
          </button>
          <span className="credit">{t("credit")}</span>
        </div>
      </div>
    </div>
  );
}
