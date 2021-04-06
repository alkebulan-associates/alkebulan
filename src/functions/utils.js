// load puppeteer
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import ghostcursor from 'ghost-cursor';
import chrome from 'chrome-cookies-secure';

export async function createSmartBrowser(skeleton_mode=true) {
  puppeteer.use(StealthPlugin())

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36'
  ];
  const options = {
    args,
    headless: skeleton_mode,
    ignoreHTTPSErrors: true,
    userDataDir: './tmp',
    ignoreDefaultArgs: ["--enable-automation"]
  };
  // create a new browser instance
  const browser = await puppeteer.launch({
    options
  });
  // get current page inside the browser;
  const [page] = await browser.pages();
  // navigate to a website and set the viewport
  await page.setViewport({ width: 1920, height: 1080 });
  // set user agent to remove headless label
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US'
  });
  if (skeleton_mode) {
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
  }
  const preloadFile = fs.readFileSync('./newDocumentPreload.js', 'utf8');
  const cursor = ghostcursor.createCursor(page);

  await page.evaluateOnNewDocument(preloadFile);

  return [browser, page, cursor]
}