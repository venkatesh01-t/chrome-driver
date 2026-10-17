
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
        driver.get("file:///C:/Users/KING/Documents/GitHub/chrome-driver/test-pages/demo-app.html")
        el = wait.until(EC.visibility_of_element_located((By.ID, "username")))
        el.clear()
        el.send_keys("enterprise_user")

        select_elem = Select(wait.until(EC.presence_of_element_located((By.ID, "plan-selection"))))
        select_elem.select_by_visible_text("Enterprise Custom")

        btn = wait.until(EC.element_to_be_clickable((By.ID, "login-button")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", btn)
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
        print(f"[PERF] Enterprise test completed in {elapsed:.2f}s")
        print("[SUCCESS] Enterprise script ran perfectly in Chrome with Iframe interaction!")
    finally:
        driver.quit()

if __name__ == "__main__":
    run_test()
