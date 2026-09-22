/**
 * Moves focus to the first field with a problem and scrolls it clear of the sticky header, so a
 * failed submit never leaves someone staring at an apparently unchanged screen wondering what
 * happened. Honours prefers-reduced-motion.
 *
 * `fieldIds` is in the order the fields appear on screen; `errors` is keyed by the same ids, with
 * any truthy value meaning "this one has a problem".
 */
export function focusFirstError(fieldIds: string[], errors: Record<string, string | undefined>) {
  const firstBad = fieldIds.find((f) => errors[f]);
  if (!firstBad) return;
  const el = document.getElementById(firstBad);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.focus({ preventScroll: true });
}
