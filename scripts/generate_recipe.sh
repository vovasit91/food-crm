#!/usr/bin/env bash
# Invent new recipes from an ingredient brief instead of scraping food.ru.
#
# Reads one brief per run from data/ideas.txt, builds a prompt from
# data/generate_prompt.txt + the DB's available IDs, calls the AI agent, and
# writes the result to results/<recipe-id>.json in the same format the food.ru
# pipeline produces — so validate_recipe.py and import_to_db.ts work unchanged.
#
# Brief format (one per line):
#   required-ingredient-ids (comma separated) | hint | hint | ...
# e.g.
#   pork-chops, garlic, mustard | dinner | pan-fried | european
#
# Usage:
#   ./generate_recipe.sh                # local agent, one brief per run
#   ./generate_recipe.sh --claude       # Claude
#   ./generate_recipe.sh --deepseek     # DeepSeek
#   ./generate_recipe.sh --copy-prompt  # build prompt, copy to clipboard, stop
#   ./generate_recipe.sh --claude --all # work through the whole queue
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
IDEAS_FILE="$PROJECT_DIR/data/ideas.txt"
DONE_FILE="$PROJECT_DIR/data/processed-ideas.txt"
DB="/Users/v-sitdikov/iOS/Food/assets/db/food.db"
OUTPUT_DIR="$PROJECT_DIR/results"
PROMPT_TEMPLATE="$PROJECT_DIR/data/generate_prompt.txt"
AGENT_FLAG=""
COPY_PROMPT=false
LOOP_ALL=false
for arg in "$@"; do
  case "$arg" in
    --deepseek)    AGENT_FLAG="--deepseek" ;;
    --claude)      AGENT_FLAG="--claude" ;;
    --copy-prompt) COPY_PROMPT=true ;;
    --all)         LOOP_ALL=true ;;
  esac
done

mkdir -p "$OUTPUT_DIR"
touch "$DONE_FILE"

# ── Atomically claim the first unclaimed brief ────────────────────────────────

BRIEF=$(python3 - "$IDEAS_FILE" "$DONE_FILE" << 'PYEOF'
import sys, os, fcntl

ideas_path, done_path = sys.argv[1], sys.argv[2]
processed = set(open(done_path).read().splitlines()) if os.path.exists(done_path) else set()

try:
    with open(ideas_path, 'r+') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        lines = f.readlines()
        brief, new_lines = None, []
        for line in lines:
            s = line.strip()
            if not s or s.startswith('#') or s.startswith('[working:]'):
                new_lines.append(line)
            elif s in processed:
                pass  # drop silently, already generated
            elif brief is None:
                brief = s
                new_lines.append(f'[working:] {s}\n')
            else:
                new_lines.append(line)
        f.seek(0); f.writelines(new_lines); f.truncate()
    print(brief or '')
except FileNotFoundError:
    print('')
PYEOF
)

if [[ -z "$BRIEF" ]]; then
  echo "ideas.txt is empty or all briefs are already processed."
  exit 0
fi

echo "→ Generating from brief: $BRIEF"

REQUIRED=$(echo "$BRIEF" | cut -d'|' -f1 | tr -d ' ')
HINTS=$(echo "$BRIEF" | cut -d'|' -f2- | tr '|' '\n' | sed 's/^ *//;s/ *$//' | paste -sd',' - | sed 's/,/, /g')
[[ "$HINTS" == "$BRIEF" ]] && HINTS="(none)"

TMPPROMPT=$(mktemp /tmp/generate_prompt.XXXXXX)
TMPOUT=""
TMPJSON=""

# On any failure: release the brief back to the queue for retry
_revert_brief() {
  python3 - "$IDEAS_FILE" "$BRIEF" << 'PYEOF'
import sys, fcntl
path, brief = sys.argv[1], sys.argv[2]
try:
    with open(path, 'r+') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        lines = f.readlines()
        lines = [l.replace(f'[working:] {brief}', brief) if l.strip() == f'[working:] {brief}' else l for l in lines]
        f.seek(0); f.writelines(lines); f.truncate()
except Exception:
    pass
PYEOF
  echo "↩ Returned to queue: $BRIEF"
}
trap '_revert_brief; rm -f "$TMPPROMPT" "$TMPOUT" "$TMPJSON"' ERR
trap 'rm -f "$TMPPROMPT" "$TMPOUT" "$TMPJSON"' EXIT

# ── Pull available IDs from DB (same queries as parse_recipe.sh) ──────────────

INGREDIENT_IDS=$(python3 - "$DB" << 'PYEOF'
import sys, sqlite3

db = sqlite3.connect(sys.argv[1])
rows = db.execute("""
    SELECT i.id, t.value, i.measurement
    FROM ingredients i
    LEFT JOIN translations t ON t.entity_id = i.id AND t.locale = 'en' AND t.entity_type = 'ingredient'
    ORDER BY i.id
""").fetchall()
# The measurement tells the model how this ingredient is counted in the DB —
# without it, countable-looking items measured in grams (meat, cheese) come back
# as "quantity: 1, unit: null", which reads as one gram.
for iid, label, measurement in rows:
    name = f"{iid}: {label}" if label else f"{iid}"
    print(f"  {name} [measured in: {measurement}]")
PYEOF
)
TAG_IDS=$(python3 - "$DB" << 'PYEOF'
import sys, sqlite3

db = sqlite3.connect(sys.argv[1])
rows = db.execute("""
    SELECT tg.id, tr.value
    FROM tags tg
    LEFT JOIN translations tr ON tr.entity_id = tg.id AND tr.locale = 'en' AND tr.entity_type = 'tag'
    ORDER BY tg.id
""").fetchall()
for tid, label in rows:
    print(f"  {tid}: {label}" if label else f"  {tid}")
PYEOF
)
KITCHEN_IDS=$(sqlite3 "$DB" "SELECT id FROM kitchen_items ORDER BY id;" | tr '\n' ', ' | sed 's/, $//')

# Existing recipes (DB + results/) so the model does not reinvent what we have
EXISTING=$(python3 - "$DB" "$OUTPUT_DIR" << 'PYEOF'
import sys, sqlite3, json
from pathlib import Path

db, results = sys.argv[1], Path(sys.argv[2])
names = set()
try:
    conn = sqlite3.connect(db)
    for (rid,) in conn.execute("SELECT id FROM recipes"):
        names.add(rid)
except Exception:
    pass
for f in results.glob("*.json"):
    try:
        data = json.loads(f.read_text())
        obj = data[0] if isinstance(data, list) else data
        names.add(obj.get("id") or f.stem)
    except Exception:
        names.add(f.stem)
for n in sorted(names):
    print(f"  - {n}")
PYEOF
)

# ── Build full prompt ─────────────────────────────────────────────────────────

cat "$PROMPT_TEMPLATE" > "$TMPPROMPT"
cat >> "$TMPPROMPT" << EOF

---

## GENERATION BRIEF

**Required ingredients (these ingredient IDs MUST appear in the recipe and be used in a step):**
$REQUIRED

**Hints (cuisine / method / meal slot / anything else):** $HINTS

**Existing recipes — your dish must be clearly different from all of these:**
$EXISTING

---

## AVAILABLE IDs FROM DATABASE

### Ingredients (id: English name)
$INGREDIENT_IDS

### Tags
$TAG_IDS

### Kitchen items
$KITCHEN_IDS
EOF

if $COPY_PROMPT; then
  pbcopy < "$TMPPROMPT"
  echo "✓ Prompt copied to clipboard"
  _revert_brief
  trap 'rm -f "$TMPPROMPT" "$TMPOUT" "$TMPJSON"' ERR
  exit 0
fi

# ── Call the agent ────────────────────────────────────────────────────────────

echo "→ Running AI agent..."
TMPOUT=$(mktemp /tmp/generate_output.XXXXXX)
python3 "$SCRIPT_DIR/call_agent.py" "$TMPPROMPT" $AGENT_FLAG > "$TMPOUT" &
AGENT_PID=$!
START_TIME=$SECONDS
while kill -0 "$AGENT_PID" 2>/dev/null; do
  printf "\r  ⏱  %ds elapsed..." $(( SECONDS - START_TIME ))
  sleep 1
done
printf "\r  ✓ Done in %ds            \n" $(( SECONDS - START_TIME ))
if ! wait "$AGENT_PID"; then
  echo "✗ Agent call failed (see $TMPOUT)" >&2
  DEBUG_COPY="$PROJECT_DIR/results/.last-agent-failure.txt"
  cp "$TMPOUT" "$DEBUG_COPY" 2>/dev/null || true
  exit 1
fi
RAW_OUTPUT=$(cat "$TMPOUT")

if [[ -z "${RAW_OUTPUT//[[:space:]]/}" ]]; then
  echo "✗ Agent returned an empty response — nothing to parse" >&2
  exit 1
fi

# ── Extract clean JSON ────────────────────────────────────────────────────────

CLEAN_JSON=$(echo "$RAW_OUTPUT" | python3 -c "
import sys, json, re
text = sys.stdin.read()
text = re.sub(r'\`\`\`(?:json)?\s*\n?', '', text.strip(), flags=re.MULTILINE)
text = re.sub(r'\n?\`\`\`\s*\$', '', text.strip(), flags=re.MULTILINE)
text = text.strip()
try:
    print(json.dumps(json.loads(text), ensure_ascii=False, indent=2)); sys.exit(0)
except json.JSONDecodeError:
    pass
m = re.search(r'(\[[\s\S]*\]|\{[\s\S]*\})', text)
if m:
    print(json.dumps(json.loads(m.group(1)), ensure_ascii=False, indent=2)); sys.exit(0)
print(text, file=sys.stderr)
sys.exit(1)
")

# ── Enforce the brief: every required ingredient present AND used ─────────────
# NOTE: the JSON goes through a temp file, not a pipe — `python3 - <<'PYEOF'`
# already uses stdin for the script itself.

TMPJSON=$(mktemp /tmp/generate_json.XXXXXX)
printf '%s' "$CLEAN_JSON" > "$TMPJSON"

python3 - "$REQUIRED" "$TMPJSON" << 'PYEOF'
import sys, json

required = [x for x in sys.argv[1].split(',') if x]
data = json.loads(open(sys.argv[2]).read())
obj = data[0] if isinstance(data, list) else data

declared = {i.get('ingredientId') for i in obj.get('ingredients', [])}
used = {si.get('ingredientId')
        for step in obj.get('cookingSteps', [])
        for si in step.get('ingredients', [])}

missing = [r for r in required if r not in declared]
unused = [r for r in required if r in declared and r not in used]
if missing:
    print(f"  required ingredient(s) absent from the recipe: {missing}", file=sys.stderr)
if unused:
    print(f"  required ingredient(s) never used in a step: {unused}", file=sys.stderr)
sys.exit(1 if (missing or unused) else 0)
PYEOF

# ── Enrich and save ───────────────────────────────────────────────────────────

CLEAN_JSON=$(echo "$CLEAN_JSON" | python3 -c "
import sys, json
brief = sys.argv[1]
data = json.load(sys.stdin)
for obj in (data if isinstance(data, list) else [data]):
    obj['source'] = 'generated'
    obj['sourceBrief'] = brief
print(json.dumps(data, ensure_ascii=False, indent=2))
" "$BRIEF")

RECIPE_ID=$(echo "$CLEAN_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
obj = data[0] if isinstance(data, list) else data
print(obj['id'])
")

OUTPUT_FILE="$OUTPUT_DIR/$RECIPE_ID.json"
echo "$CLEAN_JSON" > "$OUTPUT_FILE"
echo "✓ Saved: $OUTPUT_FILE"

python3 "$SCRIPT_DIR/validate_recipe.py" "$OUTPUT_FILE" --allow-missing-image || {
  echo "✗ Validation failed — file kept for inspection, brief returned to queue"
  exit 1
}

# ── Record the brief as processed ─────────────────────────────────────────────

python3 - "$IDEAS_FILE" "$BRIEF" "$DONE_FILE" << 'PYEOF'
import sys, fcntl
ideas_path, brief, done_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(ideas_path, 'r+') as f:
    fcntl.flock(f, fcntl.LOCK_EX)
    lines = [l for l in f.readlines() if l.strip() not in (f'[working:] {brief}', brief)]
    f.seek(0); f.writelines(lines); f.truncate()
with open(done_path, 'a') as f:
    f.write(brief + '\n')
PYEOF

trap 'rm -f "$TMPPROMPT" "$TMPOUT" "$TMPJSON"' ERR  # disarm the revert trap
echo "✓ Done: $RECIPE_ID"
echo "  Photo still pending — run generate_image.sh with the recipe's imagePrompt."

REMAINING=$(grep -v '^#' "$IDEAS_FILE" | grep -c . || true)
if $LOOP_ALL; then
  exec "$0" "$@"
fi
echo "  $REMAINING brief(s) left in the queue — run again for the next one, or pass --all."
