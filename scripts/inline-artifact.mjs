// Arma un único HTML (CSS y JS embebidos) a partir de dist-artifact/, para publicar la app
// como página de claude.ai. Uso: npm run build:artifact
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-artifact';
const html = readFileSync(join(dir, 'index.html'), 'utf8');

const asset = (re, kind) => {
  const match = html.match(re);
  if (!match) throw new Error(`No se encontró el ${kind} en ${dir}/index.html`);
  return readFileSync(join(dir, match[1]), 'utf8');
};

const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? 'Sistema MRP PCP';
const css = asset(/<link rel="stylesheet"[^>]*href="\.\/([^"]+\.css)"/, 'CSS');
// "</script" dentro del bundle cerraría la etiqueta antes de tiempo.
const js = asset(/<script type="module"[^>]*src="\.\/([^"]+\.js)"/, 'JS').replaceAll('</script', '<\\/script');

const out = `<title>${title}</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
writeFileSync(join(dir, 'sistema-mrp.html'), out);
console.log(`${dir}/sistema-mrp.html (${(out.length / 1024).toFixed(0)} KB)`);
