#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
LINKS_FILE="$PROJECT_DIR/data/links.txt"
DB="/Users/v-sitdikov/iOS/Food/assets/db/food.db"
OUTPUT_DIR="$PROJECT_DIR/results"
PROMPT_TEMPLATE="$PROJECT_DIR/data/agent_prompt.txt"
AGENT_FLAG=""
[[ "${1:-}" == "--deepseek" ]] && AGENT_FLAG="--deepseek"

mkdir -p "$OUTPUT_DIR"

# Atomically claim the first unclaimed, unprocessed URL
URL=$(python3 - "$LINKS_FILE" "$PROJECT_DIR/data/processed-links.txt" << 'PYEOF'
import sys, fcntl

links_path, done_path = sys.argv[1], sys.argv[2]
try:
    processed = set(open(done_path).read().splitlines()) if __import__('os').path.exists(done_path) else set()
except Exception:
    processed = set()

try:
    with open(links_path, 'r+') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        lines = f.readlines()
        url = None
        new_lines = []
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith('[working:]'):
                new_lines.append(line)
            elif stripped in processed:
                print(f'[skip] already processed: {stripped}', file=__import__('sys').stderr)
                # drop it from the queue silently
            elif url is None:
                url = stripped
                new_lines.append(f'[working:] {stripped}\n')
            else:
                new_lines.append(line)
        f.seek(0)
        f.writelines(new_lines)
        f.truncate()
    print(url or '')
except FileNotFoundError:
    print('')
PYEOF
)

if [[ -z "$URL" ]]; then
  echo "links.txt is empty or all URLs are already being processed."
  exit 0
fi

echo "→ Parsing: $URL"

# Fetch full page once to temp file
TMPHTML=$(mktemp /tmp/recipe_html.XXXXXX)
TMPPROMPT=$(mktemp /tmp/recipe_prompt.XXXXXX)
TMPOUT=""

# On any failure: revert [working:] prefix so the URL stays available for retry
_revert_url() {
  python3 - "$LINKS_FILE" "$URL" << 'PYEOF'
import sys, fcntl
path, url = sys.argv[1], sys.argv[2]
try:
    with open(path, 'r+') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        lines = f.readlines()
        new_lines = [l.replace(f'[working:] {url}', url) if l.strip() == f'[working:] {url}' else l for l in lines]
        f.seek(0); f.writelines(new_lines); f.truncate()
except Exception:
    pass
PYEOF
  echo "↩ Reverted to queue: $URL"
}
trap '_revert_url; rm -f "$TMPHTML" "$TMPPROMPT" "$TMPOUT"' ERR
trap 'rm -f "$TMPHTML" "$TMPPROMPT" "$TMPOUT"' EXIT

curl -sL "$URL" > "$TMPHTML"

# ── Extract recipe fields ──────────────────────────────────────────────────────

TITLE=$(htmlq '.hrecipe [itemprop="name"]' --text < "$TMPHTML" \
  | head -n 1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

TIME_RAW=$(htmlq '.hrecipe [itemprop="totalTime"]' --attribute content < "$TMPHTML" \
  | head -n 1)

DESCRIPTION=$(htmlq '.hrecipe [itemprop="description"]' --text < "$TMPHTML" \
  | head -n 1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

CATEGORY=$(htmlq '.hrecipe [itemprop="recipeCategory"]' --attribute content < "$TMPHTML" \
  | head -n 1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

INGREDIENTS=$(htmlq '.hrecipe [itemprop="recipeIngredient"]' --text < "$TMPHTML")

STEPS=$(htmlq '.hrecipe [itemprop="recipeInstructions"]' < "$TMPHTML")

# Parse ISO 8601 duration → minutes (PT30M or PT1H30M)
TIME_MINUTES=$(TIME_ISO="$TIME_RAW" python3 -c "
import re, os
s = os.environ.get('TIME_ISO', '').strip()
h = re.search(r'(\d+)H', s)
m = re.search(r'(\d+)M', s)
total = (int(h.group(1)) * 60 if h else 0) + (int(m.group(1)) if m else 0)
print(total if total > 0 else 30)
")

# Extract best cover image: fit/1200 webp (recipe cover, not fill/ which is avatars)
IMAGE=$(python3 - "$TMPHTML" << 'PYEOF'
import sys, re
with open(sys.argv[1]) as f:
    html = f.read()
urls = re.findall(r'https://cdn\.food\.ru/unsigned/fit/\S+?\.webp(?=[ ",])', html)
for u in urls:
    if '/1200/' in u:
        print(u); sys.exit(0)
if urls:
    print(urls[0])
PYEOF
)

# ── Pull available IDs from DB ─────────────────────────────────────────────────

# Ingredients: join DB IDs with English labels from translations
INGREDIENT_IDS=$(python3 - "$DB" << 'PYEOF'
import sys, sqlite3

db = sqlite3.connect(sys.argv[1])
rows = db.execute("""
    SELECT i.id, t.value
    FROM ingredients i
    LEFT JOIN translations t ON t.entity_id = i.id AND t.locale = 'en' AND t.entity_type = 'ingredient'
    ORDER BY i.id
""").fetchall()
for iid, label in rows:
    print(f"  {iid}: {label}" if label else f"  {iid}")
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

# ── Build full prompt ──────────────────────────────────────────────────────────

cat "$PROMPT_TEMPLATE" > "$TMPPROMPT"
cat >> "$TMPPROMPT" << EOF

---

## RAW RECIPE DATA

**URL:** $URL
**Title (Russian):** $TITLE
**Total time (minutes):** $TIME_MINUTES
**Category:** $CATEGORY
**Description (from page):** $DESCRIPTION
**Cover image URL:** $IMAGE

**Ingredients (raw from page, one per line):**
$INGREDIENTS

**Cooking steps (raw HTML elements, may include step images):**
$STEPS

---

## AVAILABLE IDs FROM DATABASE

### Ingredients (id: English name)
$INGREDIENT_IDS

### Tags
$TAG_IDS

### Kitchen items
$KITCHEN_IDS
EOF

# ── Call Claude agent ──────────────────────────────────────────────────────────

echo "→ Running local AI agent..."
TMPOUT=$(mktemp /tmp/recipe_output.XXXXXX)
python3 "$SCRIPT_DIR/call_agent.py" "$TMPPROMPT" $AGENT_FLAG > "$TMPOUT" &
AGENT_PID=$!
START_TIME=$SECONDS
while kill -0 "$AGENT_PID" 2>/dev/null; do
  printf "\r  ⏱  %ds elapsed..." $(( SECONDS - START_TIME ))
  sleep 1
done
printf "\r  ✓ Done in %ds            \n" $(( SECONDS - START_TIME ))
wait "$AGENT_PID"
RAW_OUTPUT=$(cat "$TMPOUT")
rm -f "$TMPOUT"

# ── Extract clean JSON ─────────────────────────────────────────────────────────

CLEAN_JSON=$(echo "$RAW_OUTPUT" | python3 -c "
import sys, json, re
text = sys.stdin.read()
text = re.sub(r'\`\`\`(?:json)?\s*\n?', '', text.strip(), flags=re.MULTILINE)
text = re.sub(r'\n?\`\`\`\s*$', '', text.strip(), flags=re.MULTILINE)
text = text.strip()
try:
    data = json.loads(text)
    print(json.dumps(data, ensure_ascii=False, indent=2))
    sys.exit(0)
except json.JSONDecodeError:
    pass
m = re.search(r'(\[[\s\S]*\]|\{[\s\S]*\})', text)
if m:
    data = json.loads(m.group(1))
    print(json.dumps(data, ensure_ascii=False, indent=2))
    sys.exit(0)
print(text, file=sys.stderr)
sys.exit(1)
")

# ── Save output ────────────────────────────────────────────────────────────────

RECIPE_ID=$(echo "$CLEAN_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
obj = data[0] if isinstance(data, list) else data
print(obj['id'])
")

OUTPUT_FILE="$OUTPUT_DIR/$RECIPE_ID.json"
echo "$CLEAN_JSON" > "$OUTPUT_FILE"
echo "✓ Saved: $OUTPUT_FILE"

NEW_STEPS_COUNT=$(echo "$CLEAN_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
obj = data[0] if isinstance(data, list) else data
print(len(obj.get('newCookingSteps', [])))
")
[[ "$NEW_STEPS_COUNT" -gt 0 ]] && echo "  (${NEW_STEPS_COUNT} new step translation(s) included)"


# ── Remove processed URL from links.txt and record it ─────────────────────────

python3 - "$LINKS_FILE" "$URL" "$PROJECT_DIR/data/processed-links.txt" << 'PYEOF'
import sys, fcntl

links_path, url, done_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(links_path, 'r+') as f:
    fcntl.flock(f, fcntl.LOCK_EX)
    lines = f.readlines()
    new_lines = [l for l in lines if l.strip() not in (f'[working:] {url}', url)]
    f.seek(0)
    f.writelines(new_lines)
    f.truncate()
with open(done_path, 'a') as f:
    f.write(url + '\n')
PYEOF

trap 'rm -f "$TMPHTML" "$TMPPROMPT"' ERR  # disarm the revert trap
echo "✓ Removed from queue: $URL"

exec "$0" "$@"
