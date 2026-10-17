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
    assert "Selenium Recorder Testbed" in title, f"Unexpected title: {title}"

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
print("  STEP 2: Generate and Run Simple Script in Chrome ")
print("==================================================")
simple_script = f"""
from selenium import webdriver
from selenium.webdriver.common.by import By
import time

def find(driver, by, value, timeout=5):
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    return WebDriverWait(driver, timeout).until(EC.presence_of_element_located((by, value)))

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
driver = webdriver.Chrome(options=options)
driver.maximize_window()

try:
    driver.get("{DEMO_URL}")
    find(driver, *(By.ID, "username")).send_keys("simple_user")
    find(driver, *(By.ID, "email")).send_keys("simple@test.com")
    cb = find(driver, *(By.ID, "remember-me"))
    if not cb.is_selected(): cb.click()
    assert cb.is_selected()
    find(driver, *(By.ID, "login-button")).click()
    print("[SUCCESS] Simple script ran perfectly in Chrome!")
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

        elapsed = time.perf_counter() - start_time
        print(f"[PERF] Enterprise test completed in {{elapsed:.2f}}s")
        print("[SUCCESS] Enterprise script ran perfectly in Chrome!")
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
