"""Real Safari/dev smoke. Never capture screenshots, cookies, passwords or page bodies."""
import os
from urllib.parse import urlparse
from selenium.common.exceptions import TimeoutException
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
    email = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'input[type="email"]')))
    password = driver.find_element(By.CSS_SELECTOR, 'input[type="password"]')
    # SafariDriver send_keys can drop characters when controlled inputs render
    # during typing (SeleniumHQ/selenium#9502). Use the native value setter and
    # actual input/change events, as React's ChangeEventPlugin tests do. This
    # still exercises the application's controlled state and real form action.
    for element, value in [(email, os.environ["E2E_EMAIL"]), (password, os.environ["E2E_PASSWORD"])]:
        driver.execute_script("""
          const [element, value] = arguments;
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
          element.dispatchEvent(new Event('input', {bubbles: true}));
          element.dispatchEvent(new Event('change', {bubbles: true}));
        """, element, value)
        wait.until(lambda browser: element.get_property("value") == value)
    assert email.get_attribute("value") == os.environ["E2E_EMAIL"], "Email input did not accept fixture entry"
    assert password.get_attribute("value") == os.environ["E2E_PASSWORD"], "Password input did not accept fixture entry"
    driver.find_element(By.XPATH, '//button[normalize-space()="Sign in"]').click()
    try:
        wait.until(EC.visibility_of_element_located(account))
    except TimeoutException:
        # Only static categories/booleans: never log field contents, response
        # bodies, screenshots, cookies or the authenticated page's full text.
        alerts = " ".join(element.text.lower() for element in driver.find_elements(By.CSS_SELECTOR, '[role="alert"]'))
        category = "credentials" if "password" in alerts or "credential" in alerts else "throttle" if "attempt" in alerts or "limit" in alerts else "network" if "network" in alerts else "unclassified"
        print({"signInFailurePath": urlparse(driver.current_url).path, "alertPresent": bool(alerts), "errorCategory": category}, flush=True)
        raise
    assert status() == 200, "Authenticated identity read failed"


try:
    # Exercise public rendering before authentication. The dedicated fixture has
    # no profile; the app intentionally sends such signed-in users to /profile.
    driver.get(origin + "/map")
    capabilities = driver.execute_script("""
      return ['webgl2', 'webgl'].map(type => {
        const gl = document.createElement('canvas').getContext(type);
        if (!gl) return false;
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return true;
      });
    """)
    print("Safari", driver.capabilities.get("browserVersion"), "WebGL2/WebGL support:", capabilities, flush=True)
    canvas = (By.CSS_SELECTOR, "canvas.maplibregl-canvas")
    fallback = (By.CSS_SELECTOR, '[aria-label="Interactive map"] [role="alert"]')
    wait.until(lambda browser: browser.find_elements(*canvas) or browser.find_elements(*fallback))
    if driver.find_elements(*canvas):
        wait.until(EC.visibility_of_element_located(canvas))
        wait.until(lambda browser: browser.find_element(By.CSS_SELECTOR, '[aria-label="Interactive world map"]').get_attribute("aria-busy") == "false")
        map_mode = "renderer"
    else:
        assert not capabilities[0], "Safari with WebGL2 must render the map"
        alert = wait.until(EC.visibility_of_element_located(fallback))
        if not os.environ.get("E2E_ARCHIVED_RELEASE") or os.environ["E2E_ARCHIVED_RELEASE"] == os.environ.get("GITHUB_SHA"):
            assert "WebGL2" in alert.text, "Unsupported graphics must explain the WebGL2 requirement"
        assert any(element.is_displayed() for element in driver.find_elements(By.CSS_SELECTOR, 'input[role="combobox"]')), "Place search must survive unsupported graphics"
        map_mode = "unsupported-graphics fallback"
    login()
    cookie = driver.get_cookie("__Host-tempvs-session")
    assert cookie and cookie.get("secure") and cookie.get("httpOnly"), "Session cookie must be secure and HttpOnly"
    wait.until(EC.url_contains("/profile"))
    driver.refresh()
    wait.until(EC.visibility_of_element_located(account))
    driver.get(origin + "/map")
    wait.until(EC.url_contains("/profile"))
    wait.until(EC.visibility_of_element_located(account))
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
    print("Actual Safari", driver.capabilities.get("browserVersion"), "passed", map_mode, "login, persistence, expiry and logout; current menu focus checked:", current_release)
finally:
    driver.quit()
