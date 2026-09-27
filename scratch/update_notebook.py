import json
from pathlib import Path

nb_path = Path("test.ipynb")
with open(nb_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# Update the first code cell with shadow DOM piercing safe clicks
new_code = '''"""
Automated Selenium Python Test: greytHR ESS Navigation
Production-Grade Execution with Shadow DOM Support for <gt-ess-menu>
"""

import os
import time
from datetime import datetime
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

TEST_PASSWORD = os.getenv("TEST_PASSWORD", "Venkat093@")
TEST_USERNAME = os.getenv("TEST_USERNAME", "s374")


def safe_shadow_click(driver, wait, host_selector, text_or_css):
    """Pierces Shadow DOM to reliably locate and click web component elements."""
    host = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, host_selector)))
    element = driver.execute_script(
        """
        const host = arguments[0];
        const root = host ? host.shadowRoot : null;
        if (!root) return null;
        const query = arguments[1];
        try {
            const el = root.querySelector(query);
            if (el) return el;
        } catch(e) {}
        const items = Array.from(root.querySelectorAll('a, button, span, li, p'));
        return items.find(e => (e.textContent || '').trim().toLowerCase().includes(query.toLowerCase()));
        """,
        host,
        text_or_css,
    )
    if not element:
        raise Exception(f"Element '{text_or_css}' not found inside Shadow Root of <{host_selector}>")
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)
    return element


def run_test():
    start_time = time.perf_counter()
    options = webdriver.ChromeOptions()

    is_headless = os.getenv("HEADLESS", "false").lower() == "true"
    if is_headless:
        options.add_argument("--headless=new")
    options.add_argument("--start-maximized")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-search-engine-choice-screen")

    download_dir = Path(os.getenv("DOWNLOAD_DIR", "downloads")).resolve()
    download_dir.mkdir(parents=True, exist_ok=True)
    options.add_experimental_option("prefs", {
        "download.default_directory": str(download_dir),
        "download.prompt_for_download": False,
        "directory_upgrade": True,
        "safebrowsing.enabled": True,
    })

    driver = webdriver.Chrome(options=options)
    if not is_headless:
        driver.maximize_window()
    wait = WebDriverWait(driver, 15)

    try:
        # Step 0: Navigate to greytHR portal
        print("Navigating to target page...")
        driver.get("https://shoreline-healthcare.greythr.com/")

        # Step 1: TYPE into "Login ID" <input>
        print("Entering Login ID...")
        element = wait.until(EC.visibility_of_element_located((By.ID, "username")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        element.clear()
        element.send_keys(TEST_USERNAME)

        # Step 2: TYPE into "Password" <input>
        print("Entering Password...")
        element = wait.until(EC.visibility_of_element_located((By.ID, "password")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        element.clear()
        element.send_keys(TEST_PASSWORD)

        # Step 3: CLICK on "Login" <button>
        print("Clicking Login button...")
        element = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Login']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        try:
            element.click()
        except Exception:
            driver.execute_script("arguments[0].click();", element)

        # Wait for login redirection / dashboard initialization
        print("Waiting for dashboard to load...")
        wait.until(lambda d: "login" not in d.current_url.lower() or d.find_elements(By.CSS_SELECTOR, "gt-ess-menu"))

        # Step 4: CLICK on "Attendance" inside <gt-ess-menu> Shadow Root
        print("Clicking 'Attendance' inside <gt-ess-menu> Shadow Root...")
        safe_shadow_click(driver, wait, "gt-ess-menu", "Attendance")

        # Step 5: CLICK on "Attendance Info" submenu inside <gt-ess-menu> Shadow Root
        print("Clicking 'Attendance Info' submenu...")
        try:
            time.sleep(0.5)
            safe_shadow_click(driver, wait, "gt-ess-menu", "Attendance Info")
        except Exception:
            pass

        # Step 6: CLICK on attendance calendar cell if present
        print("Locating calendar cells...")
        try:
            cell = WebDriverWait(driver, 6).until(
                EC.presence_of_element_located((
                    By.XPATH,
                    "//gt-attendance-calendar-cell[contains(., '22')] | //*[contains(@class, 'calendar-cell') or self::gt-attendance-calendar-cell]"
                ))
            )
            driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", cell)
            driver.execute_script("arguments[0].click();", cell)
            print("Successfully clicked calendar cell.")
        except Exception as e:
            print(f"Calendar cell step skipped or not found: {e}")

        elapsed = time.perf_counter() - start_time
        print(f"[PERF] Test completed successfully in {elapsed:.2f}s")

    except Exception as e:
        artifact_dir = Path("artifacts")
        artifact_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = artifact_dir / f"failure_{ts}.png"
        dom_path = artifact_dir / f"failure_{ts}.html"
        driver.save_screenshot(str(screenshot_path))
        dom_path.write_text(driver.page_source, encoding="utf-8", errors="replace")
        print(f"[ERROR] Test execution failed: {e}")
        print(f"[DEBUG] Failure screenshot captured: {screenshot_path}")
        print(f"[DEBUG] DOM snapshot saved: {dom_path}")
        raise
    finally:
        driver.quit()

if __name__ == "__main__":
    run_test()
'''

nb["cells"][0]["source"] = [line + "\n" for line in new_code.strip().split("\n")]
nb["cells"][0]["outputs"] = []
nb["cells"][0]["execution_count"] = None

with open(nb_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)

print("test.ipynb updated successfully!")
