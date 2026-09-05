/* published-surfaces.mjs — what the estate publishes, read from the page that
 * publishes it.
 *
 * Two gates used to decide which surfaces they were responsible for from a
 * directory-name regex:
 *
 *     /^v9(\.\d+)*$/          and then: newest name wins, the rest is history
 *
 * Both consequences were measured on 2026-09-05:
 *
 *   - `uk_renewables_pipeline/202609051156/` — the build that was cut that day
 *     and is the first link on the homepage — matches no version pattern at
 *     all. link-targets classified it 'live' only by falling off the end of
 *     the function, and repd-rows could not see it: its 10/10 was a statement
 *     about v9.7, the control, and about no candidate.
 *   - Nine directories the homepage links RIGHT NOW (v7, v9, v9.4, v9.5,
 *     v9.5.1, v9.6, v9.6.1, v9.6.2, v9.7) were excluded from the verdict as
 *     "superseded history" while every one of them serves
 *     <a href="../../repd_grid_atlasv8/">MAP ATLAS</a> to a real reader.
 *
 * A directory name is not a publication decision. The homepage is. So this
 * reads globalgrid2050/index.html — the same bytes served at
 * https://globalgrid2050.com/ — and returns the set of paths it links. A
 * surface the homepage links is supported and has to be right; a directory it
 * does not link is reported with its count and left alone.
 *
 * Offline by construction: the local clone's index.html, never a fetch. If the
 * clone and the live site ever disagree, that is a different gate's job, and
 * this one names the file it read so the disagreement is visible.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const clean = (href) => href.split('?')[0].split('#')[0];

/* A repo-relative path with no './' and no trailing slash, or null if the href
   points off-site, at a fragment, or above the repo root. */
function toRepoPath(href) {
    const value = clean(String(href).trim());
    if (!value || /^[a-z]+:/i.test(value) || value.startsWith('//') || value.startsWith('#')) return null;
    const stripped = value.replace(/^\.\//, '').replace(/^\//, '').replace(/\/+$/, '');
    if (!stripped || stripped.startsWith('..')) return null;
    return stripped;
}

export function homepageSurfaces(parent, repo = 'globalgrid2050') {
    const homepage = path.join(parent, repo, 'index.html');
    if (!existsSync(homepage)) {
        return {
            ok: false,
            repo,
            homepage,
            source: `${repo}/index.html`,
            paths: new Set(),
            why: `${repo}/index.html is not present, so nothing can be said about which surfaces the estate publishes`,
            publishes: () => false,
            pipelineDirs: []
        };
    }
    const source = readFileSync(homepage, 'utf8');
    const paths = new Set(['index.html']);
    for (const m of source.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)) {
        const p = toRepoPath(m[1]);
        if (p) paths.add(p);
    }

    /* A file is published if the homepage links it, or links a directory it
       sits under. index.html of a linked directory is the page that directory
       serves. */
    const publishes = (repoRelPath) => {
        const norm = String(repoRelPath).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
        if (paths.has(norm)) return true;
        const parts = norm.split('/');
        for (let i = parts.length - 1; i > 0; i -= 1) {
            if (paths.has(parts.slice(0, i).join('/'))) return true;
        }
        return false;
    };

    const pipelineDirs = [...paths]
        .map((p) => p.match(/^uk_renewables_pipeline\/([^/]+)$/))
        .filter(Boolean)
        .map((m) => m[1])
        .filter((n) => !n.endsWith('.html'))
        .sort();

    return {
        ok: paths.size > 1,
        repo,
        homepage,
        source: `${repo}/index.html`,
        paths,
        why: `${paths.size - 1} link target(s) on ${repo}/index.html`,
        publishes,
        pipelineDirs
    };
}
