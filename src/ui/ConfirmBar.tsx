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
      <button type="button" className="btn line" onClick={onCancel} tabIndex={show ? 0 : -1}>
        {t("removePin")}
      </button>
      <button type="button" className="btn go" onClick={onConfirm} tabIndex={show ? 0 : -1}>
        {t("confirm")} <kbd className="kbd-hint">Enter</kbd>
      </button>
    </div>
  );
}
