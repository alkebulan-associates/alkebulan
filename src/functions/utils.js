// load puppeteer
import puppeteer from 'puppeteer-extra';
// import puppeteer from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import ghostcursor from 'ghost-cursor';
// import chrome from 'chrome-cookies-secure';
import fs from 'fs';

export async function createSmartBrowser(skeleton_mode = true) {
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
  const browser = await puppeteer.launch(options);
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
        if ( ["image", "stylesheet", "font", "script"].includes(req.resourceType()) ) {
          req.abort();
        }
        else {
          req.continue();
        }
      } catch (error) {

      }
    });
  }
  // Load in operations to be done before page is rendered to avoid automation detection
  const preloadFile = fs.readFileSync('./src/functions/newDocumentPreload.js', 'utf8');
  await page.evaluateOnNewDocument(preloadFile);
  // do we need to create a new tab? still not sure....
  const cursor = ghostcursor.createCursor(page);
  return {
    "browser": browser,
    "page": page,
    "cursor": cursor
  }
}

function getCallerFile() {
  // Save original Error.prepareStackTrace
  const tmp = Error.prepareStackTrace
  // Override with function that just returns `stack`
  Error.prepareStackTrace = function (_, stack) {
    return stack
  }
  // Create a new `Error`, which automatically gets `stack`
  const err = new Error()
  // Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`
  const stack = err.stack
  // Restore original `Error.prepareStackTrace`
  Error.prepareStackTrace = tmp
  // Shift out calls to getCaller and isMain to find original
  // file of called function
  stack.shift() // isMain --> getCaller --> Error
  stack.shift() // (???) --> isMain --> getCaller
  return stack[0].getFileName()
}

export function isMain() {
  // get current file we are in
  const callerFile = getCallerFile().split("//")[1]
  // get currently running module
  const currentModule = process.argv[1];
  return callerFile == currentModule;
}

export function failureCallback(error) {
  console.error("Error running file: " + error);
}