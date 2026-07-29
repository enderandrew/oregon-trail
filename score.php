<?php
/**
 * score.php — leaderboard backend (replaces api.php; "api" in the path is
 * blocked by the 8G Firewall .htaccess rules).
 *
 * Endpoints:
 *   GET  score.php?action=token          -> { "token": "..." }  (call at run start)
 *   GET  score.php                       -> top standard scores (JSON array)
 *   GET  score.php?mode=daily&date=YYYY-MM-DD -> that day's daily board
 *   GET  score.php?mode=<any mode>&limit=25   -> any mode's board
 *   POST score.php  (JSON body)          -> record a score
 *
 * Anti-abuse model (honest about its limits — the client is untrusted, so
 * this raises the effort bar rather than making cheating impossible):
 *   - A submission requires a server-issued token. Tokens are single-use,
 *     bound to the requesting IP (hashed), must be at least MIN_RUN_SECONDS
 *     old (nobody finishes a run in under a minute) and at most
 *     MAX_TOKEN_AGE old.
 *   - Daily Challenge: at most ONE submission per (ip_hash, date), enforced
 *     by a partial UNIQUE index in SQLite — a race between two requests
 *     still can't double-insert.
 *   - Token issuance is rate-limited per IP.
 *   - Names are length-capped, control-char-stripped, and checked against
 *     words.json server-side (the client checks too, but the client lies).
 *   - Scores are capped at a sane maximum.
 *
 * Schema is mode-aware from day one: the `mode` column plus `challenge_date`
 * supports the Daily Challenge now and the future mutators (winter, ghost,
 * nudist, luddite, vegetarian, ramsey) without migration — each mode's board
 * is just a WHERE clause.
 */

declare(strict_types=1);

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

const DB_PATH          = __DIR__ . '/scores.sqlite';
const WORDS_PATH       = __DIR__ . '/words.json';
const MIN_RUN_SECONDS  = 60;          // token must be at least this old to submit
const MAX_TOKEN_AGE    = 48 * 3600;   // ...and no older than this
const MAX_SCORE        = 1000000;
const MAX_NAME_LEN     = 20;
const TOKENS_PER_HOUR  = 30;          // per IP
const VALID_MODES      = ['standard', 'daily', 'winter', 'ghost', 'nudist', 'luddite', 'vegetarian', 'ramsey'];
const DEFAULT_LIMIT    = 10;
const MAX_LIMIT        = 100;

// ---------------------------------------------------------------------------

function respond(int $status, $body): void {
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 3000');

    $pdo->exec('CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS tokens (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        token      TEXT NOT NULL UNIQUE,
        ip_hash    TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        used_at    INTEGER
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS scores (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name           TEXT NOT NULL,
        score          INTEGER NOT NULL,
        profession     TEXT,
        status         TEXT,
        difficulty     TEXT,
        mode           TEXT NOT NULL DEFAULT \'standard\',
        challenge_date TEXT,
        created_at     INTEGER NOT NULL,
        ip_hash        TEXT NOT NULL,
        token_id       INTEGER REFERENCES tokens(id)
    )');
    // One daily submission per IP per date — enforced by the database, not
    // just application logic, so concurrent requests can't slip through.
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_once
                ON scores(challenge_date, ip_hash) WHERE mode = 'daily'");
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_board
                ON scores(mode, challenge_date, score DESC)');
    return $pdo;
}

/**
 * IPs are never stored raw — only an HMAC with a per-install secret salt
 * (generated on first run, kept in the DB). Good enough to dedupe and rate
 * limit without keeping identifiable addresses on disk.
 */
function ipHash(): string {
    $pdo = db();
    $row = $pdo->query("SELECT value FROM meta WHERE key = 'salt'")->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        $salt = bin2hex(random_bytes(32));
        $stmt = $pdo->prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('salt', ?)");
        $stmt->execute([$salt]);
        $row = $pdo->query("SELECT value FROM meta WHERE key = 'salt'")->fetch(PDO::FETCH_ASSOC);
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return hash_hmac('sha256', $ip, $row['value']);
}

function loadBadWords(): array {
    if (!is_readable(WORDS_PATH)) return [];
    $data = json_decode((string)file_get_contents(WORDS_PATH), true);
    return (is_array($data) && isset($data['words']) && is_array($data['words'])) ? $data['words'] : [];
}

/**
 * mb_* functions live in the mbstring extension, which not every host has.
 * Prefer them when present; fall back to byte-based equivalents (worst case
 * a multibyte name gets clipped mid-character at the length cap).
 */
function safeLower(string $s): string {
    return function_exists('mb_strtolower') ? mb_strtolower($s) : strtolower($s);
}
function safeSubstr(string $s, int $start, int $len): string {
    return function_exists('mb_substr') ? mb_substr($s, $start, $len) : substr($s, $start, $len);
}

function nameIsOffensive(string $name): bool {
    $lower = safeLower($name);
    foreach (loadBadWords() as $word) {
        if ($word !== '' && str_contains($lower, safeLower((string)$word))) return true;
    }
    return false;
}

function cleanName(string $raw): string {
    // Two independent layers of defense are cheaper than one: the JS client
    // escapes at render time regardless of source (see escapeHtmlAttr in
    // scripts.js), and this strips actual tag syntax before the name ever
    // reaches the database. Stripping here (not HTML-entity-escaping) is
    // deliberate — this is a JSON API, not an HTML renderer, so storing
    // pre-escaped entities would be the wrong layer for that job and would
    // leak &amp;-style artifacts into any future non-HTML consumer.
    $name = strip_tags(trim($raw));
    $name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?? '';
    return safeSubstr($name, 0, MAX_NAME_LEN);
}

// ---------------------------------------------------------------------------

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && ($_GET['action'] ?? '') === 'token') {
    $pdo = db();
    $ip = ipHash();

    // Rate limit issuance per IP
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM tokens WHERE ip_hash = ? AND created_at > ?');
    $stmt->execute([$ip, time() - 3600]);
    if ((int)$stmt->fetchColumn() >= TOKENS_PER_HOUR) {
        respond(429, ['error' => 'rate_limited']);
    }

    $token = bin2hex(random_bytes(16));
    $stmt = $pdo->prepare('INSERT INTO tokens (token, ip_hash, created_at) VALUES (?, ?, ?)');
    $stmt->execute([$token, $ip, time()]);

    // Opportunistic cleanup of long-expired tokens
    $pdo->prepare('DELETE FROM tokens WHERE created_at < ? AND used_at IS NULL')
        ->execute([time() - MAX_TOKEN_AGE]);

    respond(200, ['token' => $token]);
}

if ($method === 'GET') {
    $pdo = db();
    $mode = $_GET['mode'] ?? 'standard';
    if (!in_array($mode, VALID_MODES, true)) $mode = 'standard';

    $limit = min(MAX_LIMIT, max(1, (int)($_GET['limit'] ?? DEFAULT_LIMIT)));

    if ($mode === 'daily') {
        $date = $_GET['date'] ?? gmdate('Y-m-d');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = gmdate('Y-m-d');
        $stmt = $pdo->prepare('SELECT name, score, profession, status, difficulty, mode,
                                      challenge_date AS challengeDate, created_at
                               FROM scores WHERE mode = ? AND challenge_date = ?
                               ORDER BY score DESC, created_at ASC LIMIT ?');
        $stmt->execute(['daily', $date, $limit]);
    } else {
        $stmt = $pdo->prepare('SELECT name, score, profession, status, difficulty, mode,
                                      challenge_date AS challengeDate, created_at
                               FROM scores WHERE mode = ?
                               ORDER BY score DESC, created_at ASC LIMIT ?');
        $stmt->execute([$mode, $limit]);
    }

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        $r['score'] = (int)$r['score'];
        $r['date'] = gmdate('n/j/Y', (int)$r['created_at']); // matches the client's display field
        unset($r['created_at']);
    }
    respond(200, $rows);
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode((string)$raw, true);
    if (!is_array($body)) respond(400, ['error' => 'bad_json']);

    $pdo = db();
    $ip = ipHash();
    $now = time();

    // --- Token: required, ours, unused, IP-bound, plausibly aged ---
    $token = (string)($body['token'] ?? '');
    if ($token === '') respond(401, ['error' => 'token_required']);

    $stmt = $pdo->prepare('SELECT id, ip_hash, created_at, used_at FROM tokens WHERE token = ?');
    $stmt->execute([$token]);
    $tok = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tok) respond(401, ['error' => 'token_unknown']);
    if ($tok['used_at'] !== null) respond(401, ['error' => 'token_used']);
    if (!hash_equals($tok['ip_hash'], $ip)) respond(401, ['error' => 'token_ip_mismatch']);
    $age = $now - (int)$tok['created_at'];
    if ($age < MIN_RUN_SECONDS) respond(401, ['error' => 'token_too_young']);
    if ($age > MAX_TOKEN_AGE) respond(401, ['error' => 'token_expired']);

    // --- Payload validation ---
    $name = cleanName((string)($body['name'] ?? ''));
    if ($name === '') respond(422, ['error' => 'name_empty']);
    if (nameIsOffensive($name)) respond(422, ['error' => 'name_rejected']);

    $score = (int)($body['score'] ?? -1);
    if ($score < 0 || $score > MAX_SCORE) respond(400, ['error' => 'score_out_of_range']);

    $mode = (string)($body['mode'] ?? 'standard');
    if (!in_array($mode, VALID_MODES, true)) $mode = 'standard';

    $challengeDate = null;
    if ($mode === 'daily') {
        // The daily's date is decided by the server, not the client — a
        // submission is only valid for TODAY (UTC), same clock that seeds
        // the challenge.
        $claimed = (string)($body['challengeDate'] ?? '');
        $todayUtc = gmdate('Y-m-d');
        if ($claimed !== $todayUtc) respond(409, ['error' => 'daily_wrong_date']);
        $challengeDate = $todayUtc;
    }

    $profession = safeSubstr(cleanName((string)($body['profession'] ?? '')), 0, 30);
    $status     = safeSubstr(cleanName((string)($body['status'] ?? '')), 0, 20);
    $difficulty = safeSubstr(cleanName((string)($body['difficulty'] ?? '')), 0, 20);

    // --- Insert (token consumed atomically with the score) ---
    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('UPDATE tokens SET used_at = ? WHERE id = ? AND used_at IS NULL');
        $stmt->execute([$now, (int)$tok['id']]);
        if ($stmt->rowCount() !== 1) {
            $pdo->rollBack();
            respond(401, ['error' => 'token_used']); // lost a race with another submit
        }

        $stmt = $pdo->prepare('INSERT INTO scores
            (name, score, profession, status, difficulty, mode, challenge_date, created_at, ip_hash, token_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$name, $score, $profession, $status, $difficulty, $mode, $challengeDate, $now, $ip, (int)$tok['id']]);

        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        // 2067 / 19 = SQLite constraint violation -> the partial unique index
        // caught a second daily submission from this IP today.
        if (str_contains($e->getMessage(), 'UNIQUE')) {
            respond(409, ['error' => 'daily_already_submitted']);
        }
        respond(500, ['error' => 'db_error']);
    }

    respond(200, ['ok' => true]);
}

respond(405, ['error' => 'method_not_allowed']);
