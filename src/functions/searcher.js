// node file writing package
// AWS
import AWS from 'aws-sdk';
// jsdom
import jsdom from "jsdom";
import { createSmartBrowser, failureCallback, isMain } from "./utils.js";

AWS.config.update({ region: process.env["REGION"] });
// Create an SQS service object
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
const domain = "https://www.macys.com/shop/sale/Special_offers,Sortby/Clearance%2FCloseout,BEST_SELLERS?id=3536";
const host = "https://www.macys.com";

async function macysSearcher() {
  // create a new browser instance
  const data = await createSmartBrowser(JSON.parse(process.env.SKELETON_MODE.toLowerCase()))
  const page = data["page"]
  const browser = data["browser"]
  const cursor = data["cursor"]
  var document = null
  // wrap all browser logic within try block to catch errors and close the browser
  try {
    // go to our specified domain
    await page.goto(domain, {
      // timeout: 5000  
    })
    // get page document
    // this code runs in the browser, and will not be outputted to the debugger
    document = new jsdom.JSDOM(await page.evaluate(() => document.querySelector('*').outerHTML)).window.document
    // close the browser
  } catch (err) {
    failureCallback(err)
    await browser.close();
    return null
  }
  await browser.close();
  // url list of items to push to SQS
  const resellItemUrls = [];
  const priceDifferences = [];
  // get all products from the sales clearance page
  const productsOnSale = Array.from(document.querySelectorAll('div.productDescription'));
  for (let productInfo of productsOnSale) {
    try {
      // get the original price span
      const originalPriceSpan = productInfo.getElementsByClassName('regular originalOrRegularPriceOnSale')[0];
      // split the span based on the dollar sign within it, then parse the price
      const originalPrice = parseFloat(originalPriceSpan.textContent.replace("$", ""));
      // console.log(`originalPrice: ${originalPrice}`)
      const salePriceSpan = productInfo.getElementsByClassName('discount')[0];
      const salePrice = parseFloat(salePriceSpan.textContent.split("$")[1]);
      // console.log(`saleprice: ${salePrice}`);
      // if sale price is nan, meaning we have an item with a varying price range
      if (isNaN(salePrice)) {
        // skip over it
        continue;
      }
      // ****************** GOLDEN RESELL RULE ******************
      // TODO: MOVE THIS OUTSIDE OF THE FUNCTION AND REFERENCE IT
      // IF THE PRICE DIFFERENCE PRICE IS ≥ $60 SELL IT
      const minimumPriceDifference = 60;
      const priceDifference = (originalPrice - salePrice);
      if (priceDifference > minimumPriceDifference) {
        // add items url to the list of items to sell on ebay
        resellItemUrls.push(
          // prepend host to item url as they do path specific links
          host + productInfo.getElementsByTagName("a")[0].href
        );
        // add the price difference
        priceDifferences.push(
          priceDifference
        );
      }
    } catch (error) {
      console.error(`product for loop error: ${error}`);
    }
  }
  // log the potential profit we can achieve
  console.log(`${resellItemUrls.length} new reselling items with pre-sale margin of $${priceDifferences.reduce((a, b) => a + b, 0)}`)
  // for each url in our sqs queue
  for (let urlString of resellItemUrls) {
    // create params for a new sqs message
    const params = {
      // Remove DelaySeconds parameter and value for FIFO queues
      DelaySeconds: 10,
      MessageAttributes: {},
      MessageBody: urlString,
      QueueUrl: process.env["SQS_QUEUE_URL"]
    };
    // post url as a message to our sqs queue
    sqs.sendMessage(params, function (err, data) {
      if (err) {
        console.log(`Error posting ${urlString} to sqs queue`, err);
      } else {
        console.log(`Successfully posted ${urlString} to sqs queue`, data.MessageId);
      }
    });
  }
}

// lambda handler for use in aws
export async function handler(event, context) {
  // run our macy's search function
  try {
    console.log("Calling Macys searcher function...")
    return await macysSearcher()
  } catch (error) {
    console.error(`error running Macys search function: ${error}`)
    return new Promise(resolve => resolve('failed to run macys searcher'))
  }
}

// if __name__ == __main__ js equivalent
if (isMain()) {
  console.log("running macys searcher")
  macysSearcher()
}