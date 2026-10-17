
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

        elapsed = time.perf_counter() - start_time
        print(f"[PERF] Enterprise test completed in {elapsed:.2f}s")
        print("[SUCCESS] Enterprise script ran perfectly in Chrome!")
    finally:
        driver.quit()

if __name__ == "__main__":
    run_test()
