import { runTotal } from "../game/scoring";
import { STATIONS, stationPool } from "../game/stations";
import type { Pool, Run } from "../game/types";
import { useI18n } from "../i18n/i18n";
import { isTouch } from "./device";
import { LangToggle } from "./LangToggle";

interface Props {
  active: Run | undefined;
  dailyDone: Run | undefined;
  pool: Pool;
  playersToday: number | null;
  memoryOnly: boolean;
  mobile: boolean;
  onPool: (pool: Pool) => void;
  onDaily: () => void;
  onFree: () => void;
  onResume: (run: Run) => void;
  onHistory: () => void;
}

export function todayLabel(locale: string): string {
  const s = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Amsterdam",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StartSheet(p: Props) {
  const { t, num, locale } = useI18n();
  const pools: [Pool, string, number][] = [
    ["all", t("poolAll"), STATIONS.length],
    ["intercity", t("poolIntercity"), stationPool("intercity").length],
  ];
  return (
    <div className="screen start-screen">
      <header className="top start" data-inset="top">
        <div className="band">
          <div className="question">
            <span className="label">{t("intro")}</span>
            <h1 id="start-title">{t("appName")}</h1>
          </div>
          <div className="side">
            <LangToggle />
          </div>
        </div>
        <div className="strip">
          <div className="links">
            <button type="button" className="link" onClick={p.onHistory}>
              {t("myRuns")}
            </button>
          </div>
        </div>
      </header>
      <div
        className="panel start-panel"
        data-inset={p.mobile ? "bottom" : "left"}
        role="dialog"
        aria-labelledby="start-title"
      >
        {p.memoryOnly && <p className="sec warning">{t("memoryWarning")}</p>}
        {p.active && (
          <section className="sec resume">
            <p>{t("resumeTitle", { round: p.active.current + 1, score: num(runTotal(p.active)) })}</p>
            <button type="button" className="btn" onClick={() => p.active && p.onResume(p.active)}>
              {t("resume")} <span aria-hidden="true">→</span>
            </button>
          </section>
        )}
        <section className="sec">
          <h2>{t("dailyTitle")}</h2>
          <p>
            {t("dailyMeta", { date: todayLabel(locale) })}
            {p.playersToday !== null && p.playersToday > 0 && (
              <>
                {" "}
                <span className="soft">
                  {p.playersToday === 1 ? t("playersTodayOne") : t("playersToday", { n: p.playersToday })}
                </span>
              </>
            )}
          </p>
          {p.dailyDone ? (
            <>
              <p className="played">{t("dailyPlayed", { score: num(p.dailyDone.total ?? runTotal(p.dailyDone)) })}</p>
              <button type="button" className="btn line" onClick={p.onDaily}>
                {t("seeResult")} <span aria-hidden="true">→</span>
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={p.onDaily}>
              {t("dailyStart")} <span aria-hidden="true">→</span>
            </button>
          )}
        </section>
        <section className="sec">
          <h2>{t("freeTitle")}</h2>
          <p>{t("freeMeta")}</p>
          <div className="radios" role="radiogroup" aria-label={t("stations")}>
            {pools.map(([pool, label, count]) => (
              <button
                key={pool}
                type="button"
                role="radio"
                aria-checked={p.pool === pool}
                className="radio"
                onClick={() => p.onPool(pool)}
              >
                <i aria-hidden="true" />
                <span>{label}</span>
                <span className="soft">{count}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn black" onClick={p.onFree}>
            {t("freeStart")} <span aria-hidden="true">→</span>
          </button>
        </section>
        <section className="sec small-print">
          <ol className="rules">
            {[t("rule1"), t(isTouch() ? "rule2Tap" : "rule2Click"), t("rule3")].map((rule, i) => (
              <li key={rule}>
                <b>{i + 1}</b>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
          <p className="credit">{t("credit")}</p>
        </section>
      </div>
    </div>
  );
}
