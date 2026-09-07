<?php
// Local preview: php -S 127.0.0.1:8080 router.php
// Production Apache uses .htaccess for the same routes.
declare(strict_types=1);
if (PHP_SAPI !== 'cli-server') {
    http_response_code(404);
    exit();
}
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if (
    str_contains($path, "\0") || str_contains($path, '\\') ||
    preg_match('~(?:^|/)\.(?!well-known(?:/|$))~', $path) ||
    preg_match('~^/api/(?:server(?:\.example)?|site|page)\.php$~', $path) ||
    in_array($path, ['/router.php', '/DEPLOY.md'], true)
) {
    http_response_code(403);
    exit('Forbidden.');
}
if ($path === '/audit.html') {
    $query = parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY);
    header('Location: /index.html' . ($query ? '?' . $query : '') . '#audit', true, 301);
    exit();
}
if (preg_match('~^/(?:|(?:index|google-ads|tracking|results|privacy|terms|cookie-policy)\.html|robots\.txt|sitemap\.xml)$~', $path)) {
    require __DIR__ . '/api/page.php';
    return true;
}
$file = realpath(__DIR__ . $path);
if (!$file || !is_file($file) || !str_starts_with($file, __DIR__ . DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    exit('Page not found.');
}
return false;
