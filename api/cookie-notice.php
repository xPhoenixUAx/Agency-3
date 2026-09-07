<?php
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function noticeReply(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    noticeReply(405, ['ok' => false]);
}

if ($method === 'POST') {
    // A same-origin custom header prevents cross-site form submissions.
    if (
        ($_SERVER['HTTP_X_COOKIE_NOTICE'] ?? '') !== '1' ||
        ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site'
    ) {
        noticeReply(403, ['ok' => false]);
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 1024) {
        noticeReply(413, ['ok' => false]);
    }
}

// Merely viewing a notice does not create a session on a content-only page.
if ($method === 'GET' && empty($_COOKIE['agency_form'])) {
    noticeReply(200, ['ok' => true, 'dismissed' => false]);
}

// Reuse the form's HttpOnly session; no new cookie or browser-storage preference.
session_name('agency_form');
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Strict',
    'path' => '/',
]);
if (!session_start()) {
    noticeReply(503, ['ok' => false]);
}
if ($method === 'POST') {
    $_SESSION['cookie_notice_version'] = 1;
}
$dismissed = ($_SESSION['cookie_notice_version'] ?? null) === 1;
session_write_close();
noticeReply(200, ['ok' => true, 'dismissed' => $dismissed]);
