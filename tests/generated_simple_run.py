
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
    driver.get("file:///C:/Users/KING/Documents/GitHub/chrome-driver/test-pages/demo-app.html")
    find(driver, *(By.ID, "username")).send_keys("simple_user")
    find(driver, *(By.ID, "email")).send_keys("simple@test.com")
    cb = find(driver, *(By.ID, "remember-me"))
    if not cb.is_selected(): cb.click()
    assert cb.is_selected()
    find(driver, *(By.ID, "login-button")).click()
    print("[SUCCESS] Simple script ran perfectly in Chrome!")
finally:
    driver.quit()
