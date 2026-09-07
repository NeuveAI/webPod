// Test-only camera diagnostic: keep the source/build and public pose sequence intact.
import { chromium } from '@playwright/test'
const launch = chromium.launch.bind(chromium)
chromium.launch = async options => {
  const browser = await launch(options)
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async options => {
    const context = await newContext(options)
    const newPage = context.newPage.bind(context)
    context.newPage = async () => {
      const page = await newPage()
      const setViewportSize = page.setViewportSize.bind(page)
      page.setViewportSize = async size => setViewportSize({ width: size.width * 2, height: size.height * 2 })
      return page
    }
    return context
  }
  return browser
}
