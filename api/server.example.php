<?php
// Copy to server.php on the server. Keep secrets out of the public site.json.
return [
    // Must be an actual mailbox on your sending domain. Configure once with your host.
    'from' => getenv('AGENCY_MAIL_FROM') ?: '',
    // The recipient and brand name always come from ../config/site.json.
    // PHP mail() requires a configured host MTA. Never report success when mail() fails.
    // For tests ONLY: provide a writable local directory via AGENCY_TEST_OUTBOX
    // and run PHP with AGENCY_ENV=test. Never enable these in production.
];
