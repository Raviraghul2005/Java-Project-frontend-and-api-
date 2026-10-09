import { chromium } from "playwright";

async function runAuthAuditTest() {
  console.log("==================================================");
  console.log("   BILL PILOT AUTH GATING & SUBSCRIPTION AUDIT    ");
  console.log("==================================================");

  let browser;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      try {
        browser = await chromium.launch({ headless: true, channel: "chrome" });
      } catch {
        browser = await chromium.launch({ headless: true, channel: "msedge" });
      }
    }
  } catch (err) {
    console.error("Failed to launch browser:", err);
    process.exit(1);
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Unauthenticated root access must redirect to /auth
    console.log("\n[TEST 1] Visiting unauthenticated http://localhost:3000...");
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/auth", { timeout: 6000 });
    const url1 = page.url();
    assert(url1.includes("/auth"), `Redirected to /auth (current URL: ${url1})`);

    // 2. Unauthenticated analytics access must redirect to /auth
    console.log("\n[TEST 2] Visiting unauthenticated http://localhost:3000/analytics...");
    await page.goto("http://localhost:3000/analytics", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/auth", { timeout: 6000 });
    const url2 = page.url();
    assert(url2.includes("/auth"), `Redirected to /auth (current URL: ${url2})`);

    // 3. Register a clean brand-new user
    console.log("\n[TEST 3] Registering brand new user account...");
    const testEmail = `pilot_${Date.now()}@test.com`;
    // Click 'Create account' tab
    await page.click("button:has-text('Create account')");
    await page.waitForTimeout(300);

    await page.fill("input[placeholder='Alex Morgan']", "Captain Pilot");
    await page.fill("input[placeholder='user@example.com']", testEmail);
    await page.fill("input[placeholder='••••••••••••']", "SecretPilot2026!");
    await page.click("button[type='submit']");

    await page.waitForURL("http://localhost:3000/", { timeout: 8000 });
    assert(page.url() === "http://localhost:3000/", "Successfully entered dashboard after registration");

    // 4. Verify clean slate: 0 subscriptions, $0.00 run rate, 0 SFI score
    console.log("\n[TEST 4] Verifying clean slate (no mock subscriptions)...");
    await page.waitForTimeout(1000);

    const cards = await page.$$("[data-testid='subscription-card']"); // Subscription cards
    assert(cards.length === 0, `Subscription cards count is 0 (found: ${cards.length})`);

    const emptyText = await page.textContent("main");
    assert(emptyText.includes("No subscriptions tracked yet"), "Clean slate empty state is displayed");
    assert(emptyText.includes("$0.00"), "Monthly run rate displays $0.00");
    assert(!emptyText.includes("Claude Pro") && !emptyText.includes("Netflix Premium"), "No mock subscriptions injected!");

    // 5. Add a single real subscription
    console.log("\n[TEST 5] Adding user's own subscription...");
    await page.click("button:has-text('+ Add Subscription')");
    await page.waitForSelector("form", { timeout: 5000 });

    await page.fill("input[placeholder*='Netflix']", "Notion Team");
    await page.fill("input[placeholder='19.99']", "16.00");
    await page.click("button[type='submit']:has-text('Create')");

    await page.waitForSelector("[data-testid='subscription-card']", { timeout: 8000 });

    const updatedCards = await page.$$("[data-testid='subscription-card']");
    assert(updatedCards.length === 1, `Now exactly 1 user subscription exists (found: ${updatedCards.length})`);
    const cardText = await page.textContent("[data-testid='subscription-card']");
    assert(cardText.includes("Notion Team") && cardText.includes("$16.00"), "Created subscription 'Notion Team' rendered correctly");

    // 6. Sign out
    console.log("\n[TEST 6] Signing out...");
    await page.click("button:has-text('Sign out')");
    await page.waitForURL("**/auth", { timeout: 6000 });
    const finalUrl = page.url();
    assert(finalUrl.includes("/auth"), `Sign out redirects to /auth (current URL: ${finalUrl})`);

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n==================================================");
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================");
  if (failed > 0) process.exit(1);
}

runAuthAuditTest();
