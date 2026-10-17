
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
    driver.get("file:///C:/Users/KING/Documents/GitHub/chrome-driver/test-pages/demo-app.html")
    el = wait.until(EC.visibility_of_element_located((By.ID, "username")))
    el.clear()
    el.send_keys("pytest_user")
    assert el.get_attribute("value") == "pytest_user"
    
    btn = wait.until(EC.element_to_be_clickable((By.ID, "login-button")))
    assert btn.is_displayed()
    btn.click()
