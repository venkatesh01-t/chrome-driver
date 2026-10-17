
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def find(driver, by, value, timeout=10):
    return WebDriverWait(driver, timeout).until(EC.presence_of_element_located((by, value)))

def click(driver, by, value, timeout=10):
    el = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, value)))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", el)
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
    driver.get("file:///C:/Users/KING/Documents/GitHub/chrome-driver/test-pages/demo-app.html")

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
    driver.execute_script("arguments[0].dispatchEvent(new Event('change', {bubbles: true}));", entropy_input)
    assert get_status(driver) == "Cost Center: CC-9900"
    print("[OK] Entropy label association verified: " + get_status(driver))

    # Torture Case 4: Custom Combobox (role='combobox' and role='option')
    click(driver, *(By.CSS_SELECTOR, "[role='combobox']"))
    click(driver, *(By.XPATH, "//*[@role='option'][normalize-space()='Production Blue']"))
    assert get_status(driver) == "Selected Env: Production Blue"
    print("[OK] Custom combobox verified: " + get_status(driver))

    # Torture Case 5: 2-Level Nested Shadow DOM Piercing
    shadow_btn = driver.execute_script(
        "let curr = document; const hosts = ['gt-ess-portal#ess-host', 'gt-attendance-widget']; for (let h of hosts) { const hostEl = curr.querySelector(h); if (!hostEl || !hostEl.shadowRoot) return null; curr = hostEl.shadowRoot; } return curr.querySelector('#shadow-swipe-btn');"
    )
    assert shadow_btn is not None, "Shadow swipe button should be resolved through 2-level shadow root"
    driver.execute_script("arguments[0].click();", shadow_btn)
    assert get_status(driver) == "Shadow Level 2 Swipe Recorded"
    print("[OK] Nested Shadow DOM verified: " + get_status(driver))

    print("[SUCCESS] All torture tests ran and replayed with 100% accuracy in Chrome!")
finally:
    driver.quit()
