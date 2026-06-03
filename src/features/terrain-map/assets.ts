// Asset loaders for the world-map view. We glob the asset folders so the demo
// renders out-of-the-box with the bundled watercolor SVGs, and automatically
// picks up real artwork (PNG/JPG/WEBP) the moment it's dropped into these dirs.

function urls(modules: Record<string, unknown>): string[] {
  return Object.keys(modules)
    .sort()
    .map((k) => modules[k] as string);
}

const bgModules = import.meta.glob('../../assets/bg/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const mountainModules = import.meta.glob('../../assets/mountains/*.{png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const catModules = import.meta.glob('../../assets/cats/*.{png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const propModules = import.meta.glob('../../assets/props/*.{png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const backgroundUrls: string[] = urls(bgModules);
export const mountainUrls: string[] = urls(mountainModules);
export const catUrls: string[] = urls(catModules);
/** Natural-element stickers: tree, bush, flowers, pond, mushrooms, signpost… */
export const propUrls: string[] = urls(propModules);

function catByName(needle: string): string {
  return catUrls.find((u) => u.includes(needle)) ?? catUrls[0] ?? '';
}

/** The climber's avatar that walks the map. */
export const walkingCatUrl: string = catByName('cat_walk');
/** Naps on peaks the climber hasn't reached yet. */
export const sleepingCatUrl: string = catByName('cat_sleep');

// The walking/sleeping cats have dedicated roles, so keep them out of the
// scattered scenery pool to avoid doubling them up.
const sceneryCats = catUrls.filter((u) => u !== walkingCatUrl && u !== sleepingCatUrl);
/** Everything scattered as background scenery: spare cats + nature props. */
export const decorationUrls: string[] = [...sceneryCats, ...propUrls];

/** Deterministic pick from a list, by index, with safe wraparound. */
export function pick<T>(list: T[], index: number, fallback: T): T {
  if (list.length === 0) return fallback;
  return list[((index % list.length) + list.length) % list.length];
}
