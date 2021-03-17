// node file writing package
const fs = require("fs");
// AWS
const AWS = require('aws-sdk');
// load puppeteer
const puppeteer = require('puppeteer');
// jsdom
const jsdom = require("jsdom")

AWS.config.update({region: process.env["REGION"]});
// Create an SQS service object
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const domain = "https://www.macys.com/shop/sale/Special_offers,Sortby/Clearance%2FCloseout,BEST_SELLERS?id=3536";
const host = "https://www.macys.com";

async function macysSearcher() {
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
  // go to our specified domain
  await page.goto(domain, {
    // timeout: 5000  
  });
  // get page document
  // this code runs in the browser, and will not be outputted to the debugger
  const document = new jsdom.JSDOM(await page.evaluate(() => document.querySelector('*').outerHTML)).window.document
  // close the browser
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
      const originalPrice = parseFloat(originalPriceSpan.textContent.replace("$",""));
      // console.log(`originalPrice: ${originalPrice}`)
      const salePriceSpan =  productInfo.getElementsByClassName('regular')[1];
      const salePrice = parseFloat(salePriceSpan.textContent.split("$")[1]);
      // console.log(`saleprice: ${salePrice}`);
      // if sale price is nan, meaning we have an item with a varying price range
      if(isNaN(salePrice)){
        // skip over it
        continue;
      }
      // ****************** GOLDEN RESELL RULE ******************
      // TODO: MOVE THIS OUTSIDE OF THE FUNCTION AND REFERENCE IT
      // IF THE PRICE DIFFERENCE PRICE IS ≥ $60 SELL IT
      const minimumPriceDifference = 60;
      const priceDifference = (originalPrice - salePrice);
      if ( priceDifference > minimumPriceDifference ) {
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
    sqs.sendMessage(params, function(err, data) {
      if (err) {
        console.log(`Error posting ${urlString} to sqs queue`, err);
      } else {
        console.log(`Successfully posted ${urlString} to sqs queue`, data.MessageId);
      }
    });
  }
  // return resolved promise to finish running the async function
  return new Promise(resolve => resolve('resolved'))
}

// lambda handler for use in aws
exports.handler =  async function(event, context) {
  // run our macy's search function
  try {
    console.log("Calling Macys searcher function...")
    return macysSearcher()
  } catch(error) {
    console.error(`error running Macys search function: ${error}`)
  }
  return new Promise(resolve => resolve('resolved'))
}

// if __name__ == __main__ js equivalent
if (typeof require !== 'undefined' && require.main === module) {
  macysSearcher()
}

// scrap functions I might use later ////////////////////////////////////////////////////////////////////////////////////
// } catch (error) {
//   // display any errors encountered during this process
//   console.log(error)
// }
// const products = await page.evaluate(() => {
//   const links = Array.from(document.querySelectorAll('.s-result-item'));
//   return links.map(link => {
//     if (link.querySelector(".a-price-whole")) {
//       return {
//         name: link.querySelector(".a-size-medium.a-color-base.a-text-normal").textContent,
//         url: link.querySelector(".a-link-normal.a-text-normal").href,
//         image: link.querySelector(".s-image").src,
//         price: parseFloat(link.querySelector(".a-price-whole").textContent.replace(/[,.]/g, m => (m === ',' ? '.' : ''))),
//       };
//     }
//   }).slice(0, 5);
// });
//   <!-- You can, however, inject variables into evaluate methods and update their values (if you wish), for example:

// let foo = 'foo'
// console.log(foo); // Outputs 'foo' as expected
// foo = await page.evaluate((injectedFoo) => {
//   return `new${injectedFoo}`;
// }, foo);
// console.log(foo); // Outputs 'newfoo' -->
  // await page.screenshot({
  //   path: "./screenshot.jpg",
  //   type: "jpeg",
  //   fullPage: true
  // });

  // const pageHtml = await page.evaluate(() => document.querySelector('*').outerHTML)
// fs.writeFile("pageHtml.txt", pageHtml, function (err) {
  //   if (err) return console.log(err);
  //   console.log('pageHtml > pageHTml.txt');
  // });