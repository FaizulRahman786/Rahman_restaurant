const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

async function getJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { response, body };
}

async function run() {
  const healthUrl = `${BASE_URL}/api/health`;
  const missingImageUrl = `${BASE_URL}/assets/images/does-not-exist/future-test.jpg`;

  const health = await getJson(healthUrl);
  if (!health.response.ok) {
    throw new Error(`Health endpoint failed: ${health.response.status}`);
  }

  const healthBody = health.body || {};
  const db = healthBody.db || {};

  const requiredHealthFields = [
    ['ok', typeof healthBody.ok === 'boolean'],
    ['uptimeSeconds', typeof healthBody.uptimeSeconds === 'number'],
    ['startedAt', typeof healthBody.startedAt === 'string' && healthBody.startedAt.length > 0],
    ['latencyMs', typeof healthBody.latencyMs === 'number'],
    ['db.connected', typeof db.connected === 'boolean'],
    ['db.pingLatencyMs', typeof db.pingLatencyMs === 'number']
  ];

  const missingField = requiredHealthFields.find(([, valid]) => !valid);
  if (missingField) {
    throw new Error(`Missing or invalid health field: ${missingField[0]}`);
  }

  const imageResponse = await fetch(missingImageUrl);
  const fallbackHeader = imageResponse.headers.get('x-fallback-image');
  const contentType = imageResponse.headers.get('content-type') || '';

  if (!imageResponse.ok) {
    throw new Error(`Image fallback request failed: ${imageResponse.status}`);
  }

  if (fallbackHeader !== 'true') {
    throw new Error(`Unexpected fallback header: ${fallbackHeader || '(null)'}`);
  }

  if (!contentType.includes('image/svg+xml')) {
    throw new Error(`Unexpected fallback content type: ${contentType || '(null)'}`);
  }

  console.log('SMOKE_HEALTH=PASS');
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`HEALTH_OK=${healthBody.ok}`);
  console.log(`HEALTH_UPTIME=${healthBody.uptimeSeconds}`);
  console.log(`HEALTH_LATENCY_MS=${healthBody.latencyMs}`);
  console.log(`DB_CONNECTED=${db.connected}`);
  console.log(`DB_PING_LATENCY_MS=${db.pingLatencyMs}`);
  console.log(`IMG_STATUS=${imageResponse.status}`);
  console.log(`IMG_FALLBACK=${fallbackHeader}`);
  console.log(`IMG_TYPE=${contentType}`);
}

run().catch((error) => {
  console.error('SMOKE_HEALTH=FAIL');
  console.error(error.message);
  process.exit(1);
});
