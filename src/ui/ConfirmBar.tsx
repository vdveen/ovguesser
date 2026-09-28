import { useI18n } from "../i18n/i18n";

export function ConfirmBar({
  show,
  onConfirm,
  onCancel,
}: {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`confirm${show ? " show" : ""}`} role="group" aria-hidden={!show}>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={onCancel}
        aria-label={t("removePin")}
        tabIndex={show ? 0 : -1}
      >
        ✕
      </button>
      <button type="button" className="btn btn-primary" onClick={onConfirm} tabIndex={show ? 0 : -1}>
        {t("confirm")} <kbd className="kbd-hint">Enter</kbd>
      </button>
    </div>
  );
}
