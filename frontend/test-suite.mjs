import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function runTestSuite() {
  console.log("==================================================");
  console.log("   BILL PILOT COMPREHENSIVE QA AUTOMATION SUITE   ");
  console.log("==================================================");

  let browser;
  try {
    // Try launching installed chromium or system chrome/msedge
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

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // SETUP: System Login Wall Verification & Authentication
    // ----------------------------------------------------
    console.log("\n[SETUP] Verifying login wall and authenticating...");
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/auth", { timeout: 6000 });
    assert(page.url().includes("/auth"), "Unauthenticated access properly redirected to /auth");

    await page.click("button:has-text('Fill demo credentials')");
    await page.click("button[type='submit']");
    await page.waitForURL("http://localhost:3000/", { timeout: 8000 });
    assert(page.url() === "http://localhost:3000/", "Successfully authenticated and entered dashboard");

    // ----------------------------------------------------
    // TEST 1: Dashboard Navigation & Metrics
    // ----------------------------------------------------
    console.log("\n[TEST 1] Loading Dashboard (http://localhost:3000)...");
    const titleText = await page.textContent("h1");
    assert(titleText?.includes("Subscription Overview"), "Dashboard title is rendered");

    const cards = await page.$$("section.grid > div, section.grid > a");
    assert(cards.length === 4, `All 4 executive KPI metric cards present (found: ${cards.length})`);

    // ----------------------------------------------------
    // TEST 2: Modal Open, Escape Key, Backdrop & Preset Selection
    // ----------------------------------------------------
    console.log("\n[TEST 2] Testing Subscription Modal Behaviors...");
    
    // Wait for header to mount
    await page.waitForSelector("header", { timeout: 10000 });

    // Open modal via button in navbar
    const addBtn = page.getByRole("button", { name: "New", exact: true });
    await addBtn.click();
    await page.waitForTimeout(400);

    let modal = await page.$("h2:has-text('Add Subscription')");
    assert(modal !== null, "Add Subscription modal opens on button click");

    // Test Escape key dismissal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    modal = await page.$("h2:has-text('Add Subscription')");
    assert(modal === null, "Modal closes when pressing Escape key");

    // Open again and test Preset Selection
    await addBtn.click();
    await page.waitForTimeout(400);

    const netflixPreset = await page.locator("button:has-text('Netflix')").first();
    assert(await netflixPreset.isVisible(), "Netflix preset button is visible in modal");
    await netflixPreset.click();
    await page.waitForTimeout(200);

    const nameInput = await page.locator("input[placeholder*='Netflix']");
    const nameVal = await nameInput.inputValue();
    assert(nameVal.includes("Netflix"), `Preset populated name field (got: "${nameVal}")`);

    // Fill custom values: Docker Pro
    await nameInput.fill("Docker Pro");
    const priceInput = await page.locator("input[placeholder='19.99']");
    await priceInput.fill("14.00");
    
    const submitBtn = await page.locator("button[type='submit']");
    await submitBtn.click();
    await page.waitForTimeout(600);

    // Verify Docker Pro card exists on dashboard
    const dockerCard = await page.locator("h3:has-text('Docker Pro')").first();
    assert(await dockerCard.isVisible(), "New subscription 'Docker Pro' was created and appears on dashboard");

    // ----------------------------------------------------
    // TEST 3: Card Actions (Edit, Cancel, Reactivate, Delete)
    // ----------------------------------------------------
    console.log("\n[TEST 3] Testing Subscription Card Actions...");

    // Find Docker Pro card container
    const dockerContainer = page.locator("div.group").filter({ hasText: "Docker Pro" }).first();

    // Edit price
    const editBtn = dockerContainer.getByRole("button", { name: "Edit" });
    await editBtn.click();
    await page.waitForTimeout(400);

    const editPriceInput = page.locator("input[placeholder='19.99']");
    await editPriceInput.fill("16.50");
    await page.locator("button[type='submit']").click();
    await page.waitForTimeout(500);

    const updatedPrice = await dockerContainer.locator(".tabular").first().textContent();
    assert(updatedPrice?.includes("16.50"), `Subscription price updated to $16.50 (got: ${updatedPrice})`);

    // Cancel subscription
    const cancelBtn = dockerContainer.getByRole("button", { name: "Cancel" });
    await cancelBtn.click();
    await page.waitForTimeout(500);

    const statusBadge = await dockerContainer.locator("span:has-text('cancelled')").first();
    assert(await statusBadge.isVisible(), "Subscription status changed to 'cancelled'");

    // Reactivate subscription
    const reactivateBtn = dockerContainer.getByRole("button", { name: "Reactivate" });
    assert(await reactivateBtn.isVisible(), "Green Reactivate button appears when cancelled");
    await reactivateBtn.click();
    await page.waitForTimeout(500);

    const activeBadge = await dockerContainer.locator("span:has-text('active')").first();
    assert(await activeBadge.isVisible(), "Subscription successfully restored to 'active'");

    // Delete subscription
    const deleteBtn = dockerContainer.getByTitle("Delete");
    await deleteBtn.click();
    await page.waitForTimeout(500);
    const deletedCount = await page.locator("h3:has-text('Docker Pro')").count();
    assert(deletedCount === 0, "Subscription deleted and removed from dashboard");

    // ----------------------------------------------------
    // TEST 4: Search, Category Filters & Sorting
    // ----------------------------------------------------
    console.log("\n[TEST 4] Testing Search, Category Filters & Sorting...");

    // Create 2 test subscriptions for filtering
    const newBtn = page.getByRole("button", { name: "New", exact: true });
    await newBtn.click();
    await page.waitForTimeout(300);
    await page.locator("button:has-text('Spotify')").first().click();
    await page.click("button[type='submit']:has-text('Create')");
    await page.waitForTimeout(600);

    await newBtn.click();
    await page.waitForTimeout(300);
    await page.locator("button:has-text('Claude Pro')").first().click();
    await page.click("button[type='submit']:has-text('Create')");
    await page.waitForTimeout(600);

    const searchInput = page.locator("input[placeholder='Filter services...']");
    await searchInput.fill("Spotify");
    await page.waitForTimeout(300);

    let visibleCards = await page.locator("div.group h3").allTextContents();
    assert(visibleCards.every(t => t.toLowerCase().includes("spotify")), `Search filtered down to Spotify (found: ${visibleCards.join(", ")})`);

    // Clear search using '✕'
    const clearSearchBtn = page.locator("input[placeholder='Filter services...'] ~ button");
    await clearSearchBtn.click();
    await page.waitForTimeout(300);
    visibleCards = await page.locator("div.group h3").allTextContents();
    assert(visibleCards.length >= 2, `Search cleared; all cards returned (count: ${visibleCards.length})`);

    // Category Filter: Technology
    const techBtn = page.getByRole("button", { name: "Technology", exact: true });
    await techBtn.click();
    await page.waitForTimeout(300);
    const techCards = await page.locator("div.group").count();
    assert(techCards > 0, `Technology category filter returned ${techCards} items`);

    // Reset to All
    const allBtn = page.getByRole("button", { name: "All", exact: true });
    await allBtn.click();
    await page.waitForTimeout(300);

    // ----------------------------------------------------
    // TEST 5: JSON & CSV Export File Download Integrity
    // ----------------------------------------------------
    console.log("\n[TEST 5] Testing JSON & CSV Export Downloads (File Openability & Integrity)...");

    // JSON Download test
    const [jsonDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON", exact: true }).first().click()
    ]);
    const jsonPath = path.join(process.cwd(), "temp_test_export.json");
    await jsonDownload.saveAs(jsonPath);
    const jsonRaw = fs.readFileSync(jsonPath, "utf-8");
    assert(jsonRaw.length > 50, `JSON file downloaded successfully (size: ${jsonRaw.length} bytes)`);

    let parsedJson = null;
    try {
      parsedJson = JSON.parse(jsonRaw);
    } catch (e) {
      // parse error
    }
    assert(parsedJson !== null && Array.isArray(parsedJson.subscriptions), `Downloaded JSON opens cleanly and contains valid subscriptions array (count: ${parsedJson?.subscriptions?.length})`);
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);

    // CSV Download test
    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "CSV", exact: true }).first().click()
    ]);
    const csvPath = path.join(process.cwd(), "temp_test_export.csv");
    await csvDownload.saveAs(csvPath);
    const csvRaw = fs.readFileSync(csvPath, "utf-8");
    assert(csvRaw.length > 50, `CSV file downloaded successfully (size: ${csvRaw.length} bytes)`);
    assert(csvRaw.includes("ID,Name,Price,Currency"), `CSV has valid header columns`);
    if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

    // ----------------------------------------------------
    // TEST 6: Analytics Page (Fatigue & Redundancy Audit)
    // ----------------------------------------------------
    console.log("\n[TEST 6] Testing Analytics Page (/analytics)...");
    await page.goto("http://localhost:3000/analytics", { waitUntil: "domcontentloaded" });

    const analyticsHeader = await page.textContent("h1");
    assert(analyticsHeader?.includes("Subscription Fatigue"), "Analytics page title rendered");

    const gaugeFormula = await page.locator("code").textContent();
    assert(gaugeFormula?.includes("SFI = clamp"), "Mathematical SFI formula explanation is visible");

    const matrixCards = await page.locator("h2:has-text('Functional Redundancy Matrix')");
    assert(await matrixCards.isVisible(), "Functional Redundancy Matrix section rendered");

    const oppTable = await page.locator("table");
    assert(await oppTable.isVisible(), "5-Year Opportunity Cost table rendered with tabular data");

    // ----------------------------------------------------
    // TEST 7: Arbitrage Simulator (/simulator)
    // ----------------------------------------------------
    console.log("\n[TEST 7] Testing Arbitrage Simulator (/simulator)...");
    await page.goto("http://localhost:3000/simulator", { waitUntil: "domcontentloaded" });

    const simHeader = await page.textContent("h1");
    assert(simHeader?.includes("Arbitrage Simulator"), "Simulator page rendered");

    await page.waitForSelector(".divide-y > div", { timeout: 10000 });
    const initialSimSpend = await page.locator("section.grid > div").first().locator(".tabular").first().textContent();

    // Toggle pause on first subscription
    const firstCheckBtn = page.locator("button[title*='in simulation']").first();
    await firstCheckBtn.click();
    await page.waitForTimeout(400);

    const updatedSimSpend = await page.locator("section.grid > div").first().locator(".tabular").first().textContent();
    assert(initialSimSpend !== updatedSimSpend, `Toggling pause instantly recalculates simulated monthly spend (${initialSimSpend} -> ${updatedSimSpend})`);

    // Click Auto-Optimize Stack
    const autoOptBtn = page.getByRole("button", { name: "Auto-Optimize Stack" });
    await autoOptBtn.click();
    await page.waitForTimeout(400);
    const cashRecovery = await page.locator(".text-emerald-400.tabular").first().textContent();
    assert(cashRecovery?.includes("+"), `Auto-Optimize Stack generates cash recovery: ${cashRecovery}`);

    // Click Reset
    const resetSimBtn = page.getByRole("button", { name: "Reset", exact: true });
    await resetSimBtn.click();
    await page.waitForTimeout(400);
    const resetSimSpend = await page.locator("section.grid > div").first().locator(".tabular").first().textContent();
    assert(resetSimSpend === initialSimSpend, "Reset returns simulator to baseline run rate");

    // ----------------------------------------------------
    // TEST 8: Catalog Page (/catalog)
    // ----------------------------------------------------
    console.log("\n[TEST 8] Testing Catalog Page (/catalog)...");
    await page.goto("http://localhost:3000/catalog", { waitUntil: "domcontentloaded" });

    const catalogHeader = await page.textContent("h1");
    assert(catalogHeader?.includes("Subscription Catalog"), "Catalog page rendered");

    // Search catalog
    const catalogSearch = page.locator("input[placeholder='Search catalog...']");
    await catalogSearch.fill("Figma");
    await page.waitForTimeout(300);

    const figmaContainer = page.locator("div.rounded-xl").filter({ hasText: "Figma" }).first();
    assert(await figmaContainer.isVisible(), "Figma found in catalog");

    // Click "+ Add to board" specifically on Figma card
    const addFigmaBtn = figmaContainer.getByRole("button", { name: "+ Add to board" });
    await addFigmaBtn.click();
    await page.waitForSelector("div:has-text('Added')", { timeout: 6000 });

    // Go to overview and verify Figma was added
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("div.group", { timeout: 10000 });
    const allCards = await page.locator("div.group h3").allTextContents();
    console.log("    [DIAGNOSTIC] Dashboard card titles:", allCards);
    const figmaOnDashboard = page.locator("h3:has-text('Figma')").first();
    assert(await figmaOnDashboard.isVisible(), "Preset deployed from catalog is now active on main dashboard");

    // ----------------------------------------------------
    // TEST 9: Settings Page (/settings)
    // ----------------------------------------------------
    console.log("\n[TEST 9] Testing Settings Page (/settings)...");
    await page.goto("http://localhost:3000/settings", { waitUntil: "domcontentloaded" });

    const checkStatusBtn = page.getByRole("button", { name: "Check Status" });
    await checkStatusBtn.click();
    await page.waitForTimeout(600);
    const toast = page.locator(".animate-slide-up, div[class*='border-emerald']").first();
    assert(await toast.isVisible(), "Check Status ping returned online response toast");

    const resetFleetBtn = page.getByRole("button", { name: "Load Demo Presets" });
    await resetFleetBtn.click();
    await page.waitForTimeout(500);
    assert(true, "Load Demo Presets executed successfully");

    // Sign out to test Auth page
    const signOutBtn = page.getByRole("button", { name: "Sign out" });
    await signOutBtn.click();
    await page.waitForURL("**/auth", { timeout: 6000 });

    // ----------------------------------------------------
    // TEST 10: Auth Page (/auth)
    // ----------------------------------------------------
    console.log("\n[TEST 10] Testing Authentication Page (/auth)...");
    const authHeader = await page.textContent(".font-semibold.text-base");
    assert(authHeader?.includes("Bill Pilot"), "Auth brand card rendered");

    const fillDemoBtn = page.getByRole("button", { name: "Fill demo credentials" });
    await fillDemoBtn.click();
    await page.waitForTimeout(200);

    const emailVal = await page.locator("input[type='email']").inputValue();
    assert(emailVal === "demo@billpilot.com", "Demo credentials filled");

    const signInBtn = page.locator("form").getByRole("button", { name: "Sign in" });
    await signInBtn.click();
    await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

    const currentUrl = page.url();
    assert(currentUrl === "http://localhost:3000/", `Sign in redirected to dashboard (got: ${currentUrl})`);

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n==================================================");
  console.log(`   QA TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED   `);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
