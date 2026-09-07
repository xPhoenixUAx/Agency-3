<?php
declare(strict_types=1);
ini_set('display_errors', '0');
require_once __DIR__ . '/site.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: SAMEORIGIN');
header('Cache-Control: no-cache');
if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET', 'HEAD'], true)) {
    header('Allow: GET, HEAD');
    http_response_code(405);
    exit('Method not allowed.');
}
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$page = str_ends_with($requestPath, '/') ? 'index.html' : basename($requestPath);
if (!in_array($page, [...array_map(fn($name) => $name . '.html', SITE_PAGES), 'robots.txt', 'sitemap.xml'], true)) {
    http_response_code(404);
    exit('Page not found.');
}
try {
    $config = site_config();
    if ($page === 'robots.txt') {
        header('Content-Type: text/plain; charset=utf-8');
        echo "User-agent: *\n";
        echo ($config['indexable'] ?? false)
            ? "Allow: /\nSitemap: " . site_url($config, 'sitemap.xml') . "\n"
            : "Disallow: /\n";
    } elseif ($page === 'sitemap.xml') {
        header('Content-Type: application/xml; charset=utf-8');
        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach (SITE_PAGES as $name) {
            echo '  <url><loc>' . htmlspecialchars(site_url($config, $name . '.html'), ENT_XML1, 'UTF-8')
                . "</loc></url>\n";
        }
        echo '</urlset>';
    } else {
        header('Content-Type: text/html; charset=utf-8');
        echo site_html($config, $page);
    }
} catch (Throwable $error) {
    error_log('Site configuration: ' . $error->getMessage());
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo 'The website is temporarily unavailable. Please try again later.';
}
