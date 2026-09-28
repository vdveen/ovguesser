import { Fragment } from "react";

/** Renders a translated string that may contain <b>…</b>, without using innerHTML. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/<b>(.*?)<\/b>/g);
  return (
    <>
      {parts.map((part, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and never reorder
        <Fragment key={i}>{i % 2 ? <strong>{part}</strong> : part}</Fragment>
      ))}
    </>
  );
}
