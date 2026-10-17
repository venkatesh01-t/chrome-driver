"""
Enterprise Selenium Test: Automated Test
Generated: 2026-10-17T06:40:24.803Z
"""

import os
import time
from datetime import datetime
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def run_test():
    start_time = time.perf_counter()
    options = webdriver.ChromeOptions()

    # 1. Environment & Options Configuration
    is_headless = os.getenv("HEADLESS", "false").lower() == "true"
    if is_headless:
        options.add_argument("--headless=new")
    options.add_argument("--start-maximized")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-search-engine-choice-screen")

    # Optional Proxy Configuration
    proxy = os.getenv("PROXY_SERVER", "").strip()
    if proxy:
        options.add_argument(f"--proxy-server={proxy}")

    # Automated Downloads Directory Configuration
    download_dir = Path(os.getenv("DOWNLOAD_DIR", "downloads")).resolve()
    download_dir.mkdir(parents=True, exist_ok=True)
    options.add_experimental_option("prefs", {
        "download.default_directory": str(download_dir),
        "download.prompt_for_download": False,
        "directory_upgrade": True,
        "safebrowsing.enabled": True,
    })

    # 2. Driver Initialization
    driver = webdriver.Chrome(options=options)
    if not is_headless:
        driver.maximize_window()
    wait = WebDriverWait(driver, 10)

    # Optional Timezone Emulation via CDP
    browser_tz = os.getenv("TIMEZONE", "").strip()
    if browser_tz:
        driver.execute_cdp_cmd("Emulation.setTimezoneOverride", {"timezoneId": browser_tz})

    try:
        # Navigate to target page
        driver.get("https://venkatesh01-t.vercel.app/resume/")

        # Step 1: Extract & Print value from "Venkatesh" in HEADER
        element = wait.until(EC.presence_of_element_located((By.XPATH, "//h1[normalize-space()='Venkatesh']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        val = element.get_attribute("value") if element.tag_name in ["input", "textarea", "select"] else element.text
        print(f"[EXTRACTED] Venkatesh: {val}")

        # Step 2: Extract & Print value from "Python, Django & AI/ML Developer" in HEADER
        element = wait.until(EC.presence_of_element_located((By.XPATH, "//p[normalize-space()='Python, Django & AI/ML Developer']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        val = element.get_attribute("value") if element.tag_name in ["input", "textarea", "select"] else element.text
        print(f"[EXTRACTED] Python, Django & AI/ML Developer: {val}")

        # Step 3: Extract & Print value from "MCA Candidate at Madurai Kamaraj University with p" in GENERIC
        element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "p.text-sm.sm\\:text-base")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        val = element.get_attribute("value") if element.tag_name in ["input", "textarea", "select"] else element.text
        print(f"[EXTRACTED] MCA Candidate at Madurai Kamaraj University with p: {val}")

        # Step 4: Extract & Print value from "Madurai, Tamil Nadu, India" in HEADER
        element = wait.until(EC.presence_of_element_located((By.XPATH, "//span[normalize-space()='Madurai, Tamil Nadu, India']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        val = element.get_attribute("value") if element.tag_name in ["input", "textarea", "select"] else element.text
        print(f"[EXTRACTED] Madurai, Tamil Nadu, India: {val}")

        # Step 5: Extract & Print value from "babuvenkatesh093@gmail.com" in LINK
        element = wait.until(EC.presence_of_element_located((By.XPATH, "//a[normalize-space()='babuvenkatesh093@gmail.com']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        val = element.get_attribute("value") if element.tag_name in ["input", "textarea", "select"] else element.text
        print(f"[EXTRACTED] babuvenkatesh093@gmail.com: {val}")

        # Step 6: Extract & Print value from "+91 99521 42302" in HEADER
        element = wait.until(EC.presence_of_element_located((By.XPATH, "//span[normalize-space()='+91 99521 42302']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        val = element.get_attribute("value") if element.tag_name in ["input", "textarea", "select"] else element.text
        print(f"[EXTRACTED] +91 99521 42302: {val}")

        # Step 7: Extract & Print value from "linkedin" in LINK
        element = wait.until(EC.presence_of_element_located((By.XPATH, "//a[normalize-space()='linkedin']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        val = element.get_attribute("value") if element.tag_name in ["input", "textarea", "select"] else element.text
        print(f"[EXTRACTED] linkedin: {val}")

        # Step 8: Extract & Print value from "github.com/venkatesh01-t" in LINK
        element = wait.until(EC.presence_of_element_located((By.XPATH, "//a[normalize-space()='github.com/venkatesh01-t']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
        val = element.get_attribute("value") if element.tag_name in ["input", "textarea", "select"] else element.text
        print(f"[EXTRACTED] github.com/venkatesh01-t: {val}")

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
