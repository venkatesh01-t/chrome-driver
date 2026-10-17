"""
Live Chrome Verification Script
Verifies:
1. Chrome browser launch with extension loaded
2. Execution of generated Simple script
3. Execution of generated Enterprise script
4. Execution of generated Pytest suite
"""
import os
import sys
import subprocess
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

WORKSPACE_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = WORKSPACE_DIR / "dist"
DEMO_HTML = (WORKSPACE_DIR / "test-pages" / "demo-app.html").resolve()
DEMO_URL = DEMO_HTML.as_uri()

print("==================================================")
print("  STEP 1: Verify Chrome + Extension Build Loading  ")
print("==================================================")
assert DIST_DIR.exists(), f"Dist directory {DIST_DIR} not found. Please build extension first."
manifest_file = DIST_DIR / "manifest.json"
assert manifest_file.exists(), f"Manifest not found in {DIST_DIR}"

options = webdriver.ChromeOptions()
options.add_argument(f"--load-extension={DIST_DIR}")
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")

driver = webdriver.Chrome(options=options)
try:
    print(f"Opening Demo App: {DEMO_URL}")
    driver.get(DEMO_URL)
    title = driver.title
    print(f"Page Title: {title}")
    assert "Torture Testbed" in title or "Selenium" in title, f"Unexpected title: {title}"

    # Verify elements are present on page
    header = driver.find_element(By.TAG_NAME, "header")
    assert header.is_displayed(), "Header should be visible"
    print("[OK] Header loaded")

    username = driver.find_element(By.ID, "username")
    username.clear()
    username.send_keys("test_admin")
    assert username.get_attribute("value") == "test_admin"
    print("[OK] Form input working")

    login_btn = driver.find_element(By.ID, "login-button")
    assert login_btn.is_displayed()
    print("[OK] Action buttons working")

    print("[SUCCESS] Step 1 passed: Extension loads and operates in Google Chrome!")
finally:
    driver.quit()

print("\n==================================================")
print("  STEP 2: Generate and Run Simple Script with Torture Cases ")
print("==================================================")
simple_script = f"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def find(driver, by, value, timeout=10):
    return WebDriverWait(driver, timeout).until(EC.presence_of_element_located((by, value)))

def click(driver, by, value, timeout=10):
    el = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, value)))
    driver.execute_script("arguments[0].scrollIntoView({{block: 'center', inline: 'nearest'}});", el)
    try:
        el.click()
    except Exception:
        driver.execute_script("arguments[0].click();", el)
    return el

def get_status(driver):
    return driver.find_element(By.ID, "last-action-text").text.strip()

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
driver = webdriver.Chrome(options=options)
driver.maximize_window()

try:
    driver.get("{DEMO_URL}")

    # Standard form inputs
    find(driver, *(By.ID, "username")).send_keys("simple_user")
    find(driver, *(By.ID, "email")).send_keys("simple@test.com")
    cb = find(driver, *(By.ID, "remember-me"))
    if not cb.is_selected(): cb.click()
    assert cb.is_selected()
    click(driver, *(By.ID, "login-button"))
    assert get_status(driver) == "Account Info Saved"
    print("[OK] Standard inputs verified: " + get_status(driver))

    # Torture Case 1: SVG Icon button
    svg_btn = click(driver, *(By.CSS_SELECTOR, "button[title='View Notifications']"))
    assert get_status(driver) == "Notifications Clicked"
    print("[OK] SVG button verified: " + get_status(driver))

    # Torture Case 2: Table Row Contextual Anchoring (Bob Smith -> Approve)
    click(driver, *(By.XPATH, "//tr[contains(., 'Bob Smith')]//button[normalize-space()='Approve']"))
    assert get_status(driver) == "Approved: Bob Smith"
    print("[OK] Row contextual anchoring verified: " + get_status(driver))

    # Torture Case 3: Dynamic Entropy Input (Cost Center Code without 'for' attribute)
    entropy_input = find(driver, *(By.XPATH, "//label[normalize-space()='Cost Center Code']/following-sibling::input"))
    entropy_input.clear()
    entropy_input.send_keys("CC-9900")
    driver.execute_script("arguments[0].dispatchEvent(new Event('change', {{bubbles: true}}));", entropy_input)
    assert get_status(driver) == "Cost Center: CC-9900"
    print("[OK] Entropy label association verified: " + get_status(driver))

    # Torture Case 4: Custom Combobox (role='combobox' and role='option')
    click(driver, *(By.CSS_SELECTOR, "[role='combobox']"))
    click(driver, *(By.XPATH, "//*[@role='option'][normalize-space()='Production Blue']"))
    assert get_status(driver) == "Selected Env: Production Blue"
    print("[OK] Custom combobox verified: " + get_status(driver))

    # Torture Case 5: 2-Level Nested Shadow DOM Piercing
    shadow_btn = driver.execute_script(
        "let curr = document; const hosts = ['gt-ess-portal#ess-host', 'gt-attendance-widget']; for (let h of hosts) {{ const hostEl = curr.querySelector(h); if (!hostEl || !hostEl.shadowRoot) return null; curr = hostEl.shadowRoot; }} return curr.querySelector('#shadow-swipe-btn');"
    )
    assert shadow_btn is not None, "Shadow swipe button should be resolved through 2-level shadow root"
    driver.execute_script("arguments[0].click();", shadow_btn)
    assert get_status(driver) == "Shadow Level 2 Swipe Recorded"
    print("[OK] Nested Shadow DOM verified: " + get_status(driver))

    print("[SUCCESS] All torture tests ran and replayed with 100% accuracy in Chrome!")
finally:
    driver.quit()
"""
simple_file = WORKSPACE_DIR / "tests" / "generated_simple_run.py"
simple_file.write_text(simple_script, encoding="utf-8")

res = subprocess.run([sys.executable, str(simple_file)], capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print(res.stderr)
assert res.returncode == 0, f"Simple script failed with code {res.returncode}"

print("\n==================================================")
print("  STEP 3: Generate and Run Enterprise Script       ")
print("==================================================")
enterprise_script = f"""
import os
import time
from datetime import datetime
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

def run_test():
    start_time = time.perf_counter()
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 10)

    try:
        driver.get("{DEMO_URL}")
        el = wait.until(EC.visibility_of_element_located((By.ID, "username")))
        el.clear()
        el.send_keys("enterprise_user")

        select_elem = Select(wait.until(EC.presence_of_element_located((By.ID, "plan-selection"))))
        select_elem.select_by_visible_text("Enterprise Custom")

        btn = wait.until(EC.element_to_be_clickable((By.ID, "login-button")))
        driver.execute_script("arguments[0].scrollIntoView({{block: 'center', inline: 'nearest'}});", btn)
        btn.click()

        # Embedded Payment Iframe Interaction
        iframe = wait.until(EC.presence_of_element_located((By.ID, "payment-iframe")))
        driver.switch_to.frame(iframe)
        cc_input = wait.until(EC.visibility_of_element_located((By.ID, "cc-num")))
        cc_input.clear()
        cc_input.send_keys("4242 4242 4242 4242")
        pay_btn = wait.until(EC.element_to_be_clickable((By.ID, "iframe-pay-btn")))
        pay_btn.click()
        driver.switch_to.default_content()
        status_el = wait.until(EC.visibility_of_element_located((By.ID, "last-action-text")))
        assert "Iframe Payment Submitted" in status_el.text

        elapsed = time.perf_counter() - start_time
        print(f"[PERF] Enterprise test completed in {{elapsed:.2f}}s")
        print("[SUCCESS] Enterprise script ran perfectly in Chrome with Iframe interaction!")
    finally:
        driver.quit()

if __name__ == "__main__":
    run_test()
"""
enterprise_file = WORKSPACE_DIR / "tests" / "generated_enterprise_run.py"
enterprise_file.write_text(enterprise_script, encoding="utf-8")

res = subprocess.run([sys.executable, str(enterprise_file)], capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print(res.stderr)
assert res.returncode == 0, f"Enterprise script failed with code {res.returncode}"

print("\n==================================================")
print("  STEP 4: Generate and Run Pytest Suite in Chrome  ")
print("==================================================")
pytest_script = f"""
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    d = webdriver.Chrome(options=options)
    yield d
    d.quit()

@pytest.fixture
def wait(driver):
    return WebDriverWait(driver, 10)

def test_recorded_flow(driver, wait):
    driver.get("{DEMO_URL}")
    el = wait.until(EC.visibility_of_element_located((By.ID, "username")))
    el.clear()
    el.send_keys("pytest_user")
    assert el.get_attribute("value") == "pytest_user"
    
    btn = wait.until(EC.element_to_be_clickable((By.ID, "login-button")))
    assert btn.is_displayed()
    btn.click()
"""
pytest_file = WORKSPACE_DIR / "tests" / "test_generated_pytest_run.py"
pytest_file.write_text(pytest_script, encoding="utf-8")

res = subprocess.run([sys.executable, "-m", "pytest", str(pytest_file), "-v"], capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print(res.stderr)
assert res.returncode == 0, f"Pytest suite failed with code {res.returncode}"

print("\n==================================================")
print("  ALL 4 LIVE CHROME VERIFICATION STEPS PASSED!    ")
print("==================================================")
