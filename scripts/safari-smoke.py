"""Real Safari/dev smoke. Never capture screenshots, cookies, passwords or page bodies."""
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

origin = os.environ.get("E2E_BASE_URL")
assert origin == "https://dev.tempvs.club", "Safari smoke is restricted to dev"
assert os.environ.get("E2E_EMAIL") and os.environ.get("E2E_PASSWORD"), "Dev fixture credentials are required"
driver = webdriver.Safari()
wait = WebDriverWait(driver, 40)
account = (By.CSS_SELECTOR, 'button[aria-label="Account menu"]')


def status():
    return driver.execute_async_script("""
      const done = arguments[0];
      fetch('/api/user/me', {cache: 'no-store'}).then(r => done(r.status)).catch(() => done(0));
    """)


def login():
    driver.get(origin + "/")
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'input[type="email"]'))).send_keys(os.environ["E2E_EMAIL"])
    driver.find_element(By.CSS_SELECTOR, 'input[type="password"]').send_keys(os.environ["E2E_PASSWORD"])
    driver.find_element(By.XPATH, '//button[normalize-space()="Sign in"]').click()
    wait.until(EC.visibility_of_element_located(account))
    assert status() == 200, "Authenticated identity read failed"


try:
    login()
    cookie = driver.get_cookie("__Host-tempvs-session")
    assert cookie and cookie.get("secure") and cookie.get("httpOnly"), "Session cookie must be secure and HttpOnly"
    driver.refresh()
    wait.until(EC.visibility_of_element_located(account))
    driver.get(origin + "/map")
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "canvas.maplibregl-canvas")))
    wait.until(lambda browser: browser.find_element(By.CSS_SELECTOR, '[aria-label="Interactive world map"]').get_attribute("aria-busy") == "false")
    # The menu focus fix belongs to this release. Archived bundles predate it;
    # rollback verification checks their common map/auth contract intact.
    archive = os.environ.get("E2E_ARCHIVED_RELEASE")
    current_release = not archive or archive == os.environ.get("GITHUB_SHA")
    if current_release:
        driver.find_element(*account).click()
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".auth-account-dropdown")))
        driver.switch_to.active_element.send_keys(Keys.ESCAPE)
        wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".auth-account-dropdown")))
    driver.delete_cookie("__Host-tempvs-session")
    assert status() == 401, "Expired session must be rejected"
    driver.execute_script("window.dispatchEvent(new Event('focus'))")
    wait.until(EC.invisibility_of_element_located(account))
    login()
    driver.find_element(*account).click()
    wait.until(EC.element_to_be_clickable((By.XPATH, '//button[normalize-space()="Log out"]'))).click()
    wait.until(EC.invisibility_of_element_located(account))
    assert status() == 401, "Logout must revoke the browser session"
    print("Actual Safari", driver.capabilities.get("browserVersion"), "passed map, login, persistence, expiry and logout; current menu focus checked:", current_release)
finally:
    driver.quit()
