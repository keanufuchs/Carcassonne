#!/usr/bin/env bash
# Build documentation.pdf from docs/ via pandoc (no mkdocs, docs/ unchanged).
# Mermaid blocks are rendered to PNG with @mermaid-js/mermaid-cli (mmdc).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs"
OUT="${1:-$ROOT/documentation.pdf}"

command -v pandoc >/dev/null || { echo "pandoc not found" >&2; exit 1; }
command -v mmdc >/dev/null || { echo "mmdc not found (npm i -g @mermaid-js/mermaid-cli)" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

IMG_DIR="$WORK/mermaid"
MD_DIR="$WORK/md"
mkdir -p "$IMG_DIR" "$MD_DIR"

# --- Cover icon ------------------------------------------------------------
# Rasterize the app's SVG icon (public/favicon.svg) for the title page.
# No standalone SVG converter is installed, but the global mermaid-cli ships a
# bundled puppeteer/Chromium that renders SVG faithfully. Fall back to the
# prebuilt build/icon.png if the headless render fails for any reason.
COVER_ICON="$IMG_DIR/cover-icon.png"
COVER_SVG="$ROOT/public/favicon.svg"

render_cover_icon() {
  local nm; nm="$(npm root -g)/@mermaid-js/mermaid-cli/node_modules"
  cat >"$WORK/render-icon.cjs" <<'JS'
const fs = require('fs');
const puppeteer = require(require.resolve('puppeteer', { paths: [process.env.MMDC_NM] }));
(async () => {
  const svg = fs.readFileSync(process.env.SVG_IN, 'utf8');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 2 });
  await page.setContent(
    '<!doctype html><meta charset="utf-8">' +
    '<style>html,body{margin:0;background:transparent}svg{width:512px;height:512px;display:block}</style>' +
    svg,
    { waitUntil: 'load' }
  );
  await (await page.$('svg')).screenshot({ path: process.env.PNG_OUT, omitBackground: true });
  await browser.close();
})();
JS
  MMDC_NM="$nm" SVG_IN="$COVER_SVG" PNG_OUT="$COVER_ICON" node "$WORK/render-icon.cjs"
}

if [[ -f "$COVER_SVG" ]] && render_cover_icon 2>/dev/null; then
  :
elif [[ -f "$ROOT/build/icon.png" ]]; then
  cp "$ROOT/build/icon.png" "$COVER_ICON"
else
  echo "warning: no cover icon available, title page will have none" >&2
fi

# LaTeX preamble: XeLaTeX does not break \href{...} link targets or long
# inline-code identifiers by default, so they overflow the text margin and
# XeLaTeX shrinks interword glue to compensate — which fuses adjacent words
# (e.g. "1.BoardViewzeigtlegaleFelder(...)", "TechnischeSpecs:specs/...").
# Narrow table cells overflow for the same reason. The additions below make
# URLs break at any character and give XeLaTeX enough stretch to wrap lines
# at word boundaries instead of fusing them. This is intentionally minimal:
# redefining \texttt with \seqsplit hangs xelatex inside the TOC / longtable
# cells (\futurelet-based macros are not expandable there), so it is avoided.
HEADER="$WORK/header.tex"
cat >"$HEADER" <<'TEX'
\usepackage{xurl}        % break URLs/links at any character
\usepackage{etoolbox}

% Slightly smaller font in wide tables so long cell content fits the column.
\AtBeginEnvironment{longtable}{\small}

\sloppy
\setlength{\emergencystretch}{3em}
TEX

# Custom title page: app icon centered above the title, with the team names
# below it. Written separately (unquoted heredoc) so $COVER_ICON expands while
# the LaTeX backslash macros stay literal.
if [[ -f "$COVER_ICON" ]]; then
  cat >>"$HEADER" <<TEX
\usepackage{graphicx}
\makeatletter
\renewcommand{\maketitle}{%
  \begin{titlepage}
  \centering
  \vspace*{3cm}
  \includegraphics[width=4.5cm]{$COVER_ICON}\par
  \vspace{1.6cm}
  {\Huge\bfseries \@title\par}
  \vspace{1.2cm}
  {\Large Von: Keanu, Neo, Paul, Jan\par}
  \vfill
  {\large \@date\par}
  \end{titlepage}
}
\makeatother
TEX
fi

DOC_FILES=(
  "$DOCS/README.md"
  "$DOCS/01_einleitung.md"
  "$DOCS/02_projektmanagement.md"
  "$DOCS/03_anforderungen.md"
  "$DOCS/04_architektur-design.md"
  "$DOCS/05_user-interface.md"
  "$DOCS/06_implementierung.md"
  "$DOCS/07_qualitaetssicherung.md"
  "$DOCS/08_installation-start.md"
  "$DOCS/09_code-leitfaden.md"
  "$DOCS/10_glossar-anhang.md"
)

MERMAID_IDX=0

render_mermaid_blocks() {
  local src="$1" dest="$2" stem="$3"
  local in_mermaid=0
  local mermaid_file=""
  local line

  : >"$dest"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^\`\`\`mermaid ]]; then
      in_mermaid=1
      MERMAID_IDX=$((MERMAID_IDX + 1))
      mermaid_file="$IMG_DIR/${stem}-${MERMAID_IDX}.mmd"
      : >"$mermaid_file"
      continue
    fi
    if (( in_mermaid )); then
      if [[ "$line" == '```' ]]; then
        in_mermaid=0
        local png="$IMG_DIR/${stem}-${MERMAID_IDX}.png"
        # In CI the bundled Chromium must run with --no-sandbox; honour an
        # optional puppeteer config file when one is provided via the env.
        mmdc -i "$mermaid_file" -o "$png" -b white -q \
          ${PUPPETEER_CONFIG_FILE:+-p "$PUPPETEER_CONFIG_FILE"}
        echo "![](${png})" >>"$dest"
        echo "" >>"$dest"
        continue
      fi
      printf '%s\n' "$line" >>"$mermaid_file"
      continue
    fi
    printf '%s\n' "$line" >>"$dest"
  done <"$src"
}

for f in "${DOC_FILES[@]}"; do
  [[ -f "$f" ]] || { echo "missing: $f" >&2; exit 1; }
  stem="$(basename "$f" .md)"
  render_mermaid_blocks "$f" "$MD_DIR/${stem}.md" "$stem"
done

PROCESSED=()
for f in "${DOC_FILES[@]}"; do
  stem="$(basename "$f" .md)"
  PROCESSED+=("$MD_DIR/${stem}.md")
done

pandoc "${PROCESSED[@]}" \
  -o "$OUT" \
  --pdf-engine=xelatex \
  --include-in-header="$HEADER" \
  -V lang=de-DE \
  -V mainfont="DejaVu Sans" \
  -V geometry:margin=2.5cm \
  -V documentclass=report \
  -V fontsize=11pt \
  --toc \
  --toc-depth=3 \
  -V colorlinks=true \
  -V linkcolor=blue \
  -V urlcolor=blue \
  --metadata title="Carcassonne Projektdokumentation" \
  --metadata date="Stand: 22.06.2026"

echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
