// load puppeteer
const puppeteer = require('puppeteer');

exports.createSmartBrowser = async () => {
    // create a new browser instance
  const browser = await puppeteer.launch({
    // headless: false
  });
  // create a page inside the browser;
  const page = await browser.newPage();
  // navigate to a website and set the viewport
  await page.setViewport({ width: 1920, height: 1080 });
  // set user agent to remove headless label
  page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36")
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US'
  });
  await page.setRequestInterception(true);
  // Now we’ll disable the CSS and images, leaving only the necessary content in the website.
  page.on('request', (req) => {
    try {
        if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
            req.abort();
        }
        else {
            req.continue();
        }
      } catch (error) {
        
      }
  });
  return browser, page
}