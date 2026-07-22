// The actual Link-in-Bio page render — shared by the editor preview and the
// public /u/<slug> page, so the preview is truthful. Pure presentational; all
// colors come from the chosen theme (no app tokens, since the public page
// stands alone). `live` enables link clicks + hover; the preview passes false.
import { getTheme, initials, type BioConfig } from '@/lib/bio-themes';

export function BioPageView({ config, live = false }: { config: BioConfig; live?: boolean }) {
  const t = getTheme(config.theme);
  const name = config.displayName || 'Your name';
  return (
    <div style={{ background: t.pageBg, color: t.cardText, minHeight: '100%' }} className="flex w-full flex-col items-center px-5 py-12">
      <div className="w-full max-w-sm text-center">
        {config.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.avatar} alt={name} width={88} height={88}
            style={{ boxShadow: `0 0 0 3px ${t.avatarRing}` }}
            className="mx-auto size-22 rounded-full object-cover" />
        ) : (
          <span style={{ background: t.linkBg, color: t.cardText, boxShadow: `0 0 0 3px ${t.avatarRing}` }}
            className="mx-auto flex size-[88px] items-center justify-center rounded-full text-2xl font-bold">
            {initials(name)}
          </span>
        )}
        <h1 style={{ color: t.cardText }} className="mt-4 text-xl font-bold tracking-tight">{name}</h1>
        {config.bio && <p style={{ color: t.subText }} className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed">{config.bio}</p>}

        <div className="mt-7 flex flex-col gap-3">
          {config.links.length === 0 && (
            <p style={{ color: t.subText }} className="text-sm">Your links will appear here.</p>
          )}
          {config.links.map((l, i) => {
            const inner = (
              <span
                style={{ background: t.linkBg, color: t.linkText, borderColor: t.linkBorder }}
                className="block rounded-xl border px-5 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
              >
                {l.label}
              </span>
            );
            return live ? (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="block">{inner}</a>
            ) : (
              <div key={i} className="block">{inner}</div>
            );
          })}
        </div>

        <a href="https://diemdesk.com/link-in-bio" target="_blank" rel="noopener noreferrer"
          style={{ color: t.subText }} className="mt-10 inline-block text-xs opacity-80 hover:opacity-100">
          Made with DiemDesk
        </a>
      </div>
    </div>
  );
}
