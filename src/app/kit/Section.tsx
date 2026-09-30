import type { ReactNode } from "react";

/** One titled section of the kit page: a landmark named by its heading, with an anchor. */
export function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="min-w-0 scroll-mt-4 border-t border-line-strong pt-6">
      <h2 id={`${id}-title`} className="text-title text-ink">
        {title}
      </h2>
      {note && <p className="mt-1 max-w-prose text-body text-ink-muted">{note}</p>}
      <div className="mt-4 flex min-w-0 flex-col gap-6">{children}</div>
    </section>
  );
}

/** A labelled group inside a section. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-label text-ink-muted">{title}</h3>
      {children}
    </div>
  );
}
