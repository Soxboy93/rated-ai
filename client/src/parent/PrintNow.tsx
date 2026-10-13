import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Renders its children as the only thing on the printed page (see the .print-sheet rules in index.css), opens the print dialog, then calls onDone. */
export default function PrintNow({ children, dir, lang, onDone }: { children: ReactNode; dir: "rtl" | "ltr"; lang: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(() => { window.print(); onDone(); }, 150);
    return () => clearTimeout(id);
  }, [onDone]);
  return createPortal(<div className="print-sheet" dir={dir} lang={lang}>{children}</div>, document.body);
}
