"""
Test: Automated Test
Target URL: https://gemini.google.com/app/5d5e003c197a3091
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
import os
import time

def smart_find(driver, locators, condition=None, timeout=10):
    """Iterate through top locator tuples with 2-attempt retry on StaleElementReferenceException."""
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
    if not isinstance(locators, list):
        locators = [locators]
    last_exc = None
    for attempt in range(2):
        for idx, (by, val) in enumerate(locators):
            try:
                cond = condition(by, val) if condition else EC.presence_of_element_located((by, val))
                t = timeout if idx == 0 else min(timeout, 3)
                el = WebDriverWait(driver, t).until(cond)
                try:
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", el)
                except Exception:
                    pass
                return el
            except (TimeoutException, StaleElementReferenceException, Exception) as exc:
                last_exc = exc
                continue
    if last_exc:
        raise last_exc
    raise TimeoutException(f"None of the locators matched within {timeout}s: {locators}")

def smart_click(driver, locators, timeout=10):
    """Click element with multi-locator fallback, automatic scroll, 2-attempt retry, and JS click fallback."""
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import StaleElementReferenceException, ElementClickInterceptedException
    from selenium.webdriver.support.ui import WebDriverWait
    # Overlay Guard: wait for transient blocking overlays to disappear
    for overlay_selector in ['[aria-busy="true"]', '.loading-overlay', '#loading-overlay', '.spinner', '#spinner']:
        try:
            WebDriverWait(driver, 2).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, overlay_selector)))
        except Exception:
            pass
    if not isinstance(locators, list):
        locators = [locators]
    last_exc = None
    for attempt in range(2):
        try:
            el = smart_find(driver, locators, condition=lambda b, v: EC.element_to_be_clickable((b, v)), timeout=timeout)
            try:
                el.click()
                return el
            except (StaleElementReferenceException, ElementClickInterceptedException) as exc:
                last_exc = exc
                try:
                    driver.execute_script("arguments[0].click();", el)
                    return el
                except Exception:
                    pass
        except Exception as exc:
            last_exc = exc
    if last_exc:
        raise last_exc

def find(driver, by, value, timeout=10):
    """Wait for element, scroll it into view, and return it."""
    return smart_find(driver, [(by, value)], timeout=timeout)

def click(driver, by, value, timeout=10):
    """Click element with automatic scroll and JavaScript click fallback if intercepted."""
    return smart_click(driver, [(by, value)], timeout=timeout)

is_headless = os.getenv("HEADLESS", "false").lower() == "true"
if is_headless:
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    driver = webdriver.Chrome(options=options)
else:
    driver = webdriver.Chrome()
driver.maximize_window()

try:
    # Open target URL
    driver.get("https://gemini.google.com/app/5d5e003c197a3091")

    # Step 1: Click in GENERIC
    click(driver, *(By.CSS_SELECTOR, r"[role=\"textbox\"][aria-label=\"Enter\ a\ prompt\ for\ Gemini\"]"))

    # Step 2: Click in GENERIC
    click(driver, *(By.CSS_SELECTOR, "div.single-line-format"))

    # Step 3: Type into<div> in INPUT
    el = find(driver, *(By.XPATH, "//*[@role=\"textbox\"][normalize-space()='hello']"))
    try:
        el.clear()
    except Exception:
        pass
    el.send_keys("hello")

    # Step 4: Press key "Enter" on<div>
    find(driver, *(By.XPATH, "//*[@role=\"textbox\"][normalize-space()='hello']")).send_keys(Keys.ENTER)

    # Step 5: Type into<div> in INPUT
    el = find(driver, *(By.CSS_SELECTOR, r"[role=\"textbox\"][aria-label=\"Enter\ a\ prompt\ for\ Gemini\"]"))
    try:
        el.clear()
    except Exception:
        pass
    el.send_keys("Sample content")

    # Step 6: Extract & Print value from "Hello again! How's your day going? What can I help" in GENERIC
    el = find(driver, *(By.XPATH, "//p[contains(normalize-space(), \"Hello again! How's your day going? What\")]"))
    val = el.get_attribute("value") if el.tag_name in ["input", "textarea", "select"] else el.text
    print(f"[EXTRACTED] Hello again! How's your day going? What can I help: {val}")

    print("[SUCCESS] Test passed successfully!")

finally:
    driver.quit()
