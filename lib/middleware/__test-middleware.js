/**
 * Simple test script to verify security headers middleware
 * Run with: node lib/middleware/__test-middleware.js
 */

// Mock VercelResponse
class MockResponse {
  constructor() {
    this.headers = {};
  }

  setHeader(key, value) {
    this.headers[key] = value;
  }

  getHeaders() {
    return this.headers;
  }

  printHeaders() {
    console.log('\n📋 Applied Security Headers:\n');
    Object.entries(this.headers).forEach(([key, value]) => {
      console.log(`✓ ${key}:`);
      if (value.length > 80) {
        console.log(`  ${value.substring(0, 77)}...`);
      } else {
        console.log(`  ${value}`);
      }
    });
  }

  verifyHeader(key, expectedValue) {
    const actualValue = this.headers[key];
    if (actualValue === expectedValue) {
      console.log(`✅ ${key}: PASS`);
      return true;
    } else {
      console.log(`❌ ${key}: FAIL`);
      console.log(`   Expected: ${expectedValue}`);
      console.log(`   Actual: ${actualValue}`);
      return false;
    }
  }
}

async function runTests() {
  console.log('🧪 Testing Security Headers Middleware\n');

  // Dynamically import the ESM module
  const { applySecurityHeaders, applyApiSecurityHeaders, API_CSP } = await import('./security-headers.ts');

  // Test 1: Standard security headers
  console.log('Test 1: applySecurityHeaders()');
  console.log('─'.repeat(50));
  const res1 = new MockResponse();
  applySecurityHeaders(res1);
  res1.printHeaders();

  console.log('\n\n🔍 Verifying Required Headers:\n');
  let allPassed = true;
  allPassed &= res1.verifyHeader('X-Frame-Options', 'DENY');
  allPassed &= res1.verifyHeader('X-Content-Type-Options', 'nosniff');
  allPassed &= res1.verifyHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  allPassed &= res1.verifyHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  if (res1.headers['Content-Security-Policy']) {
    console.log('✅ Content-Security-Policy: PRESENT');
  } else {
    console.log('❌ Content-Security-Policy: MISSING');
    allPassed = false;
  }

  if (res1.headers['Permissions-Policy']) {
    console.log('✅ Permissions-Policy: PRESENT');
  } else {
    console.log('❌ Permissions-Policy: MISSING');
    allPassed = false;
  }

  // Test 2: API-specific security headers
  console.log('\n\nTest 2: applyApiSecurityHeaders()');
  console.log('─'.repeat(50));
  const res2 = new MockResponse();
  applyApiSecurityHeaders(res2);
  res2.printHeaders();

  console.log('\n\n🔍 Verifying API CSP:\n');
  const expectedApiCsp = "default-src 'none'; frame-ancestors 'none'";
  if (res2.headers['Content-Security-Policy'] === expectedApiCsp) {
    console.log('✅ API CSP is correctly restricted');
  } else {
    console.log('❌ API CSP mismatch');
    allPassed = false;
  }

  // Test 3: Custom headers
  console.log('\n\nTest 3: Custom Headers and Options');
  console.log('─'.repeat(50));
  const res3 = new MockResponse();
  applySecurityHeaders(res3, {
    includeHSTS: false,
    customHeaders: {
      'X-Custom-Test': 'test-value',
    },
  });

  if (!res3.headers['Strict-Transport-Security']) {
    console.log('✅ HSTS correctly excluded when includeHSTS=false');
  } else {
    console.log('❌ HSTS should not be present');
    allPassed = false;
  }

  if (res3.headers['X-Custom-Test'] === 'test-value') {
    console.log('✅ Custom headers correctly applied');
  } else {
    console.log('❌ Custom headers not applied');
    allPassed = false;
  }

  // Summary
  console.log('\n\n' + '═'.repeat(50));
  if (allPassed) {
    console.log('✅ All tests PASSED');
    console.log('═'.repeat(50));
    process.exit(0);
  } else {
    console.log('❌ Some tests FAILED');
    console.log('═'.repeat(50));
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
