<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}
if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    reply(405, ['ok' => false, 'message' => 'Method not allowed.']);
}
session_name('agency_form');
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Strict',
    'path' => '/',
]);
session_start();
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['csrf']) || time() - (int) ($_SESSION['issued'] ?? 0) > 3600) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        $_SESSION['issued'] = time();
    }
    reply(200, ['csrf' => $_SESSION['csrf']]);
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) {
    reply(413, ['ok' => false, 'message' => 'Request is too large.']);
}
$csrf = $_POST['csrf'] ?? '';
if (
    !is_string($csrf) ||
    empty($_SESSION['csrf']) ||
    !hash_equals($_SESSION['csrf'], $csrf) ||
    time() - (int) ($_SESSION['issued'] ?? 0) > 3600
) {
    reply(403, ['ok' => false, 'message' => 'Your session expired. Please try again.']);
}
// No proxy headers are trusted. Configure your host to pass the real client address.
$bucketDir = sys_get_temp_dir() . '/agency-rate-' . substr(hash('sha256', __DIR__), 0, 12);
if (!is_dir($bucketDir) && !@mkdir($bucketDir, 0700, true) && !is_dir($bucketDir)) {
    reply(503, ['ok' => false, 'message' => 'Please try again later.']);
}
$bucket =
    $bucketDir . '/' . hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown')) . '.json';
$handle = @fopen($bucket, 'c+');
if (!$handle || !flock($handle, LOCK_EX)) {
    reply(503, ['ok' => false, 'message' => 'Please try again later.']);
}
$history = json_decode(stream_get_contents($handle) ?: '[]', true);
$history = is_array($history)
    ? array_values(array_filter($history, fn($t) => is_int($t) && $t > time() - 600))
    : [];
if (count($history) >= 5) {
    flock($handle, LOCK_UN);
    fclose($handle);
    header('Retry-After: 600');
    reply(429, ['ok' => false, 'message' => 'Too many requests. Please try again in 10 minutes.']);
}
$history[] = time();
ftruncate($handle, 0);
rewind($handle);
fwrite($handle, json_encode($history));
fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);
// Remove old non-personal rate buckets gradually; no form bodies are stored here.
if (random_int(1, 100) === 1) {
    foreach (glob($bucketDir . '/*.json') ?: [] as $old) {
        if ((@filemtime($old) ?: time()) < time() - 86400) {
            @unlink($old);
        }
    }
}
if (!empty($_POST['company_url'])) {
    reply(422, ['ok' => false, 'message' => 'Unable to process this request.']);
}
$config = json_decode((string) @file_get_contents(__DIR__ . '/../config/site.json'), true);
$formOptions = json_decode((string) @file_get_contents(__DIR__ . '/../config/form.json'), true);
if (
    !is_array($config) ||
    !is_string($config['name'] ?? null) ||
    trim($config['name']) === '' ||
    strlen($config['name']) > 200 ||
    preg_match('/[\r\n\x00]/', $config['name']) ||
    !is_array($formOptions)
) {
    reply(503, ['ok' => false, 'message' => 'The form is temporarily unavailable.']);
}
foreach (['businessTypes', 'budgets', 'needs'] as $list) {
    if (!isset($formOptions[$list]) || !is_array($formOptions[$list]) || !$formOptions[$list]) {
        reply(503, ['ok' => false, 'message' => 'The form is temporarily unavailable.']);
    }
}
$limits = [
    'name' => 120,
    'email' => 254,
    'website' => 2048,
    'company' => 160,
    'business_type' => 100,
    'budget' => 100,
    'need' => 100,
    'message' => 4000,
];
$data = [];
$errors = [];
foreach ($limits as $key => $limit) {
    $value = $_POST[$key] ?? '';
    if (!is_string($value)) {
        $errors[$key] = 'Invalid value.';
        $value = '';
    }
    $value = trim(str_replace(["\0"], '', $value));
    // Byte ceilings are deliberate and documented, independent of mbstring.
    if (strlen($value) > $limit) {
        $errors[$key] = 'This field is too long.';
    }
    $data[$key] = $value;
}
$kind = $_POST['form_kind'] ?? 'audit';
if (!is_string($kind) || !in_array($kind, ['home', 'audit'], true)) {
    reply(422, ['ok' => false, 'message' => 'Invalid form.']);
}
$required =
    $kind === 'home'
        ? ['name', 'email', 'website', 'need']
        : ['name', 'email', 'website', 'business_type', 'need'];
foreach ($required as $key) {
    if ($data[$key] === '') {
        $errors[$key] = 'This field is required.';
    }
}
if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $data['email'])) {
    $errors['email'] = 'Enter a valid email.';
}
$url = parse_url($data['website']);
if (
    !filter_var($data['website'], FILTER_VALIDATE_URL) ||
    !is_array($url) ||
    !in_array(strtolower($url['scheme'] ?? ''), ['https', 'http'], true)
) {
    $errors['website'] = 'Enter a full website URL, including https://.';
}
foreach (
    ['business_type' => 'businessTypes', 'budget' => 'budgets', 'need' => 'needs']
    as $key => $list
) {
    if ($data[$key] !== '' && !in_array($data[$key], $formOptions[$list], true)) {
        $errors[$key] = 'Choose an available option.';
    }
}
if (($_POST['privacy'] ?? '') !== '1') {
    $errors['privacy'] = 'Please read and acknowledge the privacy notice.';
}
if ($errors) {
    reply(422, [
        'ok' => false,
        'message' => 'Check the required fields and your website URL.',
        'errors' => $errors,
    ]);
}
$to = $config['email'] ?? '';
$from = $config['mailFrom'] ?? '';
// One contact address is sufficient; override only if the host requires another sender.
if ($from === '') $from = $to;
foreach ([$to, $from] as $mailbox) {
    if (
        !is_string($mailbox) ||
        !filter_var($mailbox, FILTER_VALIDATE_EMAIL) ||
        preg_match('/[\r\n]/', $mailbox) ||
        preg_match('/@(?:[^@]+\.)?(?:example\.(?:com|org|net)|localhost)$/i', $mailbox)
    ) {
        reply(503, [
            'ok' => false,
            'message' => 'The form is not configured yet. Please use the contact email.',
        ]);
    }
}
$subjectText = $config['name'] . ' - Website audit request';
$subject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';
$body = 'New audit request for ' . $config['name'] . "\n\n";
foreach ($data as $key => $value) {
    $body .= strtoupper(str_replace('_', ' ', $key)) . ":\n" . $value . "\n\n";
}
$headers = [
    'From' => $from,
    'Reply-To' => $data['email'],
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
];
$outbox = getenv('AGENCY_TEST_OUTBOX');
if (getenv('AGENCY_ENV') === 'test' && is_string($outbox) && is_dir($outbox)) {
    $preview = 'To: ' . $to . "\nSubject: " . $subject . "\n";
    foreach ($headers as $key => $value) {
        $preview .= $key . ': ' . $value . "\n";
    }
    $sent =
        file_put_contents(
            $outbox . '/' . bin2hex(random_bytes(12)) . '.txt',
            $preview . "\n" . $body,
            LOCK_EX
        ) !== false;
} else {
    $sent = function_exists('mail') && @mail($to, $subject, $body, $headers);
}
if (!$sent) {
    reply(503, [
        'ok' => false,
        'message' =>
            'Your request could not be sent. Please try again later or use the contact email.',
    ]);
}
unset($_SESSION['csrf'], $_SESSION['issued']);
reply(200, ['ok' => true]);
