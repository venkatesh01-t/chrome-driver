"""
Enterprise Playwright Test: Automated Test
Generated: 2026-10-17T15:11:42.435Z
"""

import os
import time
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

def run_test():
    start_time = time.perf_counter()
    is_headless = os.getenv("HEADLESS", "false").lower() == "true"
    artifact_dir = Path("artifacts")
    artifact_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=is_headless, args=["--disable-blink-features=AutomationControlled"])
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=str(artifact_dir / "videos") if os.getenv("RECORD_VIDEO") == "true" else None
        )
        context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = context.new_page()
        page.set_default_timeout(10000)

        try:
            # Navigate to target page
            page.goto("https://github.com/venkatesh01-t?tab=repositories")

            # Step 1: Click "chrome-driver" in LINK
            page.locator("xpath=//a[normalize-space()='chrome-driver']").or_(page.locator(r"a[href=\"\/venkatesh01-t\/chrome-driver\"]")).or_(page.locator("a[href*=\"chrome-driver\"]")).locator("visible=true").first.click()

            # Step 2: Scroll page to 0,340.79998779296875
            page.evaluate("window.scrollBy(0, 340.79998779296875)")

            # Step 3: Scroll page to 0,0
            page.evaluate("window.scrollBy(0, 0)")

            # Step 4: Click "Code" in LINK
            page.locator("xpath=//a[normalize-space()='Code']").or_(page.locator("xpath=(//a)[72]")).or_(page.locator("xpath=//header[.//h2[normalize-space()='Repository navigation']]//a[normalize-space()='Code']")).locator("visible=true").first.click()

            # Step 5: Click in LINK (Filtered duplicate jump-link)
            # page.locator("#code-view-repo-link").or_(page.locator(r"a[href*=\"chrome-driver\"]")).or_(page.locator("xpath=(//a)[79]")).locator("visible=true").first.click()

            # Step 6: Click "venkatesh01-t" in LINK
            page.locator("xpath=(//a)[70]").or_(page.locator("xpath=//a[normalize-space()='venkatesh01-t']")).or_(page.locator(r"a[href=\"\/venkatesh01-t\"]")).locator("visible=true").first.click()

            # Step 7: Extract & Print value from "Overview Repositories 17" in GENERIC
            el = page.locator("xpath=(//div)[104]").or_(page.locator("div.Layout-main")).locator("visible=true").first
            try:
                val = el.input_value()
            except Exception:
                val = el.inner_text()
            print(f"[EXTRACTED] Overview                  Repositories     17: {val}")

            # Step 8: Scroll page to 0,452
            page.evaluate("window.scrollBy(0, 452)")

            # Step 9: Scroll page to 0,0
            page.evaluate("window.scrollBy(0, 0)")

            # Step 10: Click "Projects 0" in NAVBAR
            page.locator("xpath=(//a)[73]").or_(page.locator("xpath=//a[normalize-space()='Projects 0']")).or_(page.locator(r"a[href=\"\/venkatesh01-t\?tab\=projects\"]")).locator("visible=true").first.click()

            # Step 11: Click "Repositories 17" in NAVBAR
            page.locator("xpath=(//a)[72]").or_(page.locator("xpath=//a[normalize-space()='Repositories 17']")).or_(page.locator(r"a[href=\"\/venkatesh01-t\?tab\=repositories\"]")).locator("visible=true").first.click()

            # Step 12: Scroll page to 0,1653.5999755859375
            page.evaluate("window.scrollBy(0, 1653.5999755859375)")

            # Step 13: Scroll page to 0,0
            page.evaluate("window.scrollBy(0, 0)")

            # Step 14: Click "Overview" in NAVBAR
            page.locator("xpath=(//a)[71]").or_(page.locator("xpath=//a[normalize-space()='Overview']")).or_(page.locator(r"a[href=\"\/venkatesh01-t\"]")).locator("visible=true").first.click()

            # Step 15: Click "Repositories 17" in NAVBAR
            page.locator("xpath=(//a)[72]").or_(page.locator("xpath=//a[normalize-space()='Repositories 17']")).or_(page.locator(r"a[href=\"\/venkatesh01-t\?tab\=repositories\"]")).locator("visible=true").first.click()

            # Step 16: Click "Projects 0" in NAVBAR
            page.locator("xpath=(//a)[73]").or_(page.locator("xpath=//a[normalize-space()='Projects 0']")).or_(page.locator(r"a[href=\"\/venkatesh01-t\?tab\=projects\"]")).locator("visible=true").first.click()

            # Step 17: Click "Repositories 17" in NAVBAR
            page.locator("xpath=(//a)[72]").or_(page.locator("xpath=//a[normalize-space()='Repositories 17']")).or_(page.locator(r"a[href=\"\/venkatesh01-t\?tab\=repositories\"]")).locator("visible=true").first.click()

            # Step 18: Click "chrome-driver" in LINK
            page.locator("xpath=//a[normalize-space()='chrome-driver']").or_(page.locator(r"a[href=\"\/venkatesh01-t\/chrome-driver\"]")).or_(page.locator("a[href*=\"chrome-driver\"]")).locator("visible=true").first.click()

            context.tracing.stop(path=str(artifact_dir / "trace.zip"))
            elapsed = time.perf_counter() - start_time
            print(f"[PERF] Test completed successfully in {elapsed:.2f}s")

        except Exception as e:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            failure_screenshot = artifact_dir / f"failure_{ts}.png"
            failure_trace = artifact_dir / f"failure_trace_{ts}.zip"
            page.screenshot(path=str(failure_screenshot), full_page=True)
            context.tracing.stop(path=str(failure_trace))
            print(f"[ERROR] Playwright execution failed: {e}")
            print(f"[DEBUG] Failure screenshot captured: {failure_screenshot}")
            print(f"[DEBUG] Tracing snapshot saved: {failure_trace}")
            raise

        finally:
            browser.close()

if __name__ == "__main__":
    run_test()
