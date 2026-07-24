import { liveToolCount } from '@/components/app/catalog';
import { FramedSlider } from './hero-variants';

// "Three steps" — the reassurance section that sits straight after the toolkit
// grid. It reuses the SAME cycling browser banner as the classic hero (imported,
// not copied, so the two can never drift), with no floating tiles: the banner
// alone carries the visual. Copy left / banner right.
const STEPS = [
  'Pick the tool you need',
  'Drop the file — it stays on your device',
  'Download the result, or send it straight to the next tool',
];

export function ToolInAction() {
  return (
    <section className="border-y bg-muted/20">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">The same, every time</p>
          <h2 className="mt-3 text-3xl font-bold leading-[1.12] tracking-tight text-balance sm:text-[2rem]">
            Three steps. {liveToolCount} tools. No surprises.
          </h2>
          <p className="mt-4 max-w-[46ch] leading-relaxed text-muted-foreground">
            Open a tool, drop your file, take the result. There&rsquo;s no account to make, no queue to wait in, and no
            upload &mdash; the work happens inside your browser, so the document never leaves your device. Merging a
            contract behaves exactly like compressing a scan or turning a photo into a PDF.
          </p>

          <ol className="mt-6 flex flex-col gap-2.5">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10.5px] font-bold text-primary">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>

          <p className="mt-5 text-xs text-muted-foreground">
            Shown here: a real tool page, cycling through three of the {liveToolCount}.
          </p>
        </div>

        <div className="mx-auto w-full max-w-[420px]">
          <FramedSlider />
        </div>
      </div>
    </section>
  );
}
