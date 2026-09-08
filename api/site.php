<?php
declare(strict_types=1);

const SITE_PAGES = [
    'index', 'google-ads', 'tracking', 'results', 'privacy', 'terms', 'cookie-policy',
];

function site_config(): array
{
    $config = json_decode(
        (string) file_get_contents(__DIR__ . '/../config/site.json'),
        true,
        512,
        JSON_THROW_ON_ERROR
    );
    foreach (['name', 'legalName', 'email', 'address', 'website', 'description'] as $key) {
        if (!is_string($config[$key] ?? null) || trim($config[$key]) === '') {
            throw new RuntimeException('Missing brand field: ' . $key);
        }
    }
    $url = parse_url($config['website']);
    if (
        array_key_exists('mailFrom', $config) &&
        (!is_string($config['mailFrom']) ||
            ($config['mailFrom'] !== '' &&
                (!filter_var($config['mailFrom'], FILTER_VALIDATE_EMAIL) ||
                    preg_match('/[\r\n\x00]/', $config['mailFrom']))))
    ) {
        throw new RuntimeException('Invalid sender email in site.json.');
    }
    if (
        !filter_var($config['email'], FILTER_VALIDATE_EMAIL) ||
        preg_match('/[\r\n\x00]/', $config['email'] . $config['name']) ||
        strlen($config['name']) > 200 ||
        !filter_var($config['website'], FILTER_VALIDATE_URL) ||
        !in_array($url['scheme'] ?? '', ['http', 'https'], true) ||
        isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])
    ) {
        throw new RuntimeException('Invalid brand contact details.');
    }
    foreach (['logo', 'logoLight', 'favicon'] as $key) {
        $value = $config[$key] ?? '';
        if (!is_string($value) || preg_match('/[\r\n\x00]/', $value)) {
            throw new RuntimeException('Invalid brand asset.');
        }
        $scheme = parse_url($value, PHP_URL_SCHEME);
        if ($scheme && !in_array(strtolower($scheme), ['http', 'https'], true)) {
            throw new RuntimeException('Invalid brand asset URL.');
        }
    }
    foreach (['logoShowName', 'indexable'] as $key) {
        if (isset($config[$key]) && !is_bool($config[$key])) {
            throw new RuntimeException('Invalid brand option.');
        }
    }
    if (!is_array($config['titles'] ?? null)) {
        throw new RuntimeException('Missing page titles in site.json.');
    }
    foreach (SITE_PAGES as $page) {
        if (!is_string($config['titles'][$page] ?? null) || trim($config['titles'][$page]) === '') {
            throw new RuntimeException('Missing page title in site.json: ' . $page);
        }
    }
    return $config;
}

function site_url(array $config, string $page): string
{
    return rtrim($config['website'], '/') . '/' . $page;
}

function site_text(DOMNode $node, string $text): void
{
    while ($node->firstChild) $node->removeChild($node->firstChild);
    $node->appendChild($node->ownerDocument->createTextNode($text));
}

function site_html(array $config, string $page): string
{
    $doc = new DOMDocument('1.0', 'UTF-8');
    $previous = libxml_use_internal_errors(true);
    $template = (string) file_get_contents(__DIR__ . '/../' . $page);
    // libxml's HTML4 parser does not recognize every HTML5 named entity (e.g. nearr).
    $template = preg_replace_callback('/&[a-zA-Z][a-zA-Z0-9]+;/', function ($match) {
        if (in_array($match[0], ['&amp;', '&lt;', '&gt;', '&quot;', '&apos;'], true)) {
            return $match[0];
        }
        return html_entity_decode($match[0], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }, $template);
    $doc->loadHTML($template, LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    $xpath = new DOMXPath($doc);
    $html = $doc->documentElement;
    $html->setAttribute('data-long-brand', strlen($config['name']) > 18 ? 'true' : 'false');
    $html->setAttribute('data-server-brand', 'true');
    foreach ($xpath->query('//*[@data-brand]') as $node) {
        $value = $config[$node->getAttribute('data-brand')] ?? null;
        if (is_string($value)) site_text($node, $value);
    }
    foreach ($xpath->query('//*[@data-email]') as $node) {
        $node->setAttribute('href', 'mailto:' . $config['email']);
        if (!$node->hasAttribute('data-email-label')) site_text($node, $config['email']);
    }
    foreach ($xpath->query('//*[@data-year]') as $node) site_text($node, date('Y'));
    foreach ($xpath->query('//*[@data-logo]') as $node) {
        $source = $node->getAttribute('data-logo-variant') === 'light'
            ? (($config['logoLight'] ?? '') ?: ($config['logo'] ?? ''))
            : ($config['logo'] ?? '');
        $showName = ($config['logoShowName'] ?? true) || $source === '';
        $node->setAttribute('class', $showName ? 'brand-lockup' : '');
        site_text($node, '');
        if ($source !== '') {
            $img = $doc->createElement('img');
            $img->setAttribute('src', $source);
            $img->setAttribute('alt', $showName ? '' : $config['name']);
            if ($showName) $img->setAttribute('aria-hidden', 'true');
            $node->appendChild($img);
        }
        if ($showName) {
            $wordmark = $doc->createElement('span');
            $wordmark->setAttribute('class', 'brand-wordmark');
            site_text($wordmark, $config['name']);
            $node->appendChild($wordmark);
        }
        foreach ($xpath->query('ancestor::a[1]', $node) as $anchor) {
            $anchor->setAttribute('aria-label', $config['name'] . ' home');
        }
    }
    $title = $config['titles'][basename($page, '.html')] . ' | ' . $config['name'];
    foreach ($xpath->query('//title') as $node) site_text($node, $title);
    $canonical = site_url($config, $page);
    foreach ($xpath->query('//meta') as $meta) {
        $key = $meta->getAttribute('property') ?: $meta->getAttribute('name');
        $value = match ($key) {
            'og:title', 'twitter:title' => $title,
            'og:site_name' => $config['name'],
            'og:url' => $canonical,
            'description', 'og:description', 'twitter:description' => $page === 'index.html'
                ? $config['description'] : $meta->getAttribute('content'),
            'robots' => ($config['indexable'] ?? false) ? 'index, follow' : 'noindex, nofollow',
            default => null,
        };
        if ($value !== null) $meta->setAttribute('content', $value);
    }
    foreach ($xpath->query('//link[@rel="canonical"]') as $node) {
        $node->setAttribute('href', $canonical);
    }
    foreach ($xpath->query('//link[@rel="icon"]') as $node) {
        if (empty($config['favicon'])) {
            $node->parentNode->removeChild($node);
            continue;
        }
        $node->setAttribute('href', $config['favicon']);
        $node->removeAttribute('type');
    }
    $noscript = $doc->createElement('noscript');
    $style = $doc->createElement('style');
    site_text($style, '.channel-panel[hidden]{display:grid!important}.channel-panel{margin-top:32px}'
        . '.tab-list,[data-menu-open],[data-filter]{display:none!important}'
        . '.no-js-nav{display:flex;flex-wrap:wrap;gap:12px;padding:16px;background:var(--surface)}');
    $noscript->appendChild($style);
    $nav = $doc->createElement('nav');
    $nav->setAttribute('class', 'no-js-nav');
    $nav->setAttribute('aria-label', 'Main navigation');
    foreach (['index' => 'Home', 'google-ads' => 'Google Ads', 'tracking' => 'Tracking', 'results' => 'Results'] as $route => $label) {
        $link = $doc->createElement('a');
        $link->setAttribute('href', $route . '.html');
        site_text($link, $label);
        $nav->appendChild($link);
    }
    $noscript->appendChild($nav);
    $body = $doc->getElementsByTagName('body')->item(0);
    $body->insertBefore($noscript, $body->firstChild);
    return $doc->saveHTML();
}
