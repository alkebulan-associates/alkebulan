import createSmartBrowser from './utils';
import createCursor from "ghost-cursor";

// AWS
const AWS = require('aws-sdk');
// load puppeteer
const puppeteer = require('puppeteer');
// jsdom
const jsdom = require("jsdom");
// update AWS config region
AWS.config.update({region: process.env["REGION"]});
// Create an SQS service object
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
// create kms for decrypting the information
const kms = new AWS.KMS({apiVersion: '2012-11-05'})
// create a SNS reference to push order updates
const sns = new AWS.SNS({apiVersion: '2012-11-05'})

async function purchaseMacysItem(itemUrlString) {
    // create inconspicuous browser and cursor
    const browser, page = createSmartBrowser();
    const cursor = createCursor(page);
    // go to item url 
    await page.goto(itemUrlString);
    // begin checkout process
    // INSTALL AND USE CHROMIUM DEBUGGER!
    // - choose size
    await page.waitForSelector("a[id=CHECKOUT]");
    document.querySelector("elementAnd.classnames go here");
    continue
    // ****** NOTIFICATION MODAL WINDOW pops up
    // find "View Bag &amp; Checkout" button
    await cursor.click("a[id=atbIntViewBagAndCheckout]");
    // now we are at a new page.
    // click "Proceed To Checkout" button
    // now we are at another new page.
    await page.waitForSelector("a[id=CHECKOUT]");
    await cursor.click("a[id=CHECKOUT]");
    // find guest checkout button
    // Click checkout as guest
    await page.waitForSelector("a[id.guest-checkout]");
    await cursor.click("a[id.guest-checkout]");
    // ****** FILLING OUT SHIPPING INFO
    const shippingInfo = context.shippingInfo
    // get shipping info for purchaser
    // await fully loaded page
    await page.waitForSelector("input[name=\"contact.firstName\"]");
    // fill in first name
    await page.type("input[name=\"contact.firstName\"]", shippingInfo["firstName"], {delay: 20});
    // fill in last name
    await page.type("input[name=\"contact.lastName\"]", shippingInfo["lastName"], {delay: 20});
    // fill in address line 1
    await page.type("input[name=\"address.addressLine1\"]", shippingInfo["addressLine1"], {delay: 20});
    // fill in address line 2
    await page.type("input[name=\"address.addressLine2\"]", shippingInfo["addressLine2"], {delay: 20});
    // fill in zipcode
    await page.type("input[name=\"address.zipCode\"]", shippingInfo["zipCode"], {delay: 20});
    // select state
    // click option with state in it
    await page.type("select[name=\"address.state\"]", shippingInfo["state"], {delay: 20});
    // fill in city
    await page.type("input[name=\"address.city\"]", shippingInfo["city"], {delay: 20});
    // fill in phone number from user
    await page.type("input[name=\"address.phone\"]", shippingInfo["phoneNumber"], {delay: 20});
    // ********* END shipping info section ***********
    // find button with text "Continue" click it
    // click continue again
    await page.waitForSelector("button[id=\"rc-shipping-group-continue\"]")
    await cursor.click("button[id=\"rc-shipping-group-continue\"]")
    // (defaulting to standard shipping)
    // click continue one more time....
    // ( might be gift options)
    await page.waitForSelector("button[id=\"rc-shipping-group-continue\"]")
    await cursor.click("button[id=\"rc-shipping-group-continue\"]")
    
    // ****** START PAYMENT INFORMATION
    // select credit card type
    await page.waitForSelector("select[name=name=\"creditCard.cardType.code\"]")
    await page.type("select[name=name=\"creditCard.cardType.code\"]", kms.decrypt(process.env.creditCcard.type).toUpperCase(), {delay: 20});
    // input card number
    await page.type("input[name=\"creditCard.cardNumber\"]", kms.decrypt(process.env.creditCcard.cardNumber), {delay: 20});
    // select month and year
    const expirationDate = new Date(kms.decrypt(process.env.creditCcard.expirationDate));
    // set the month
    await page.select("select[name=creditCard.expMonth]", expirationDate.getMonth(), {delay: 20});
    continue //set month here
    // set the year
    await page.select("select[name=creditCard.expYear]", expirationDate.getFullYear(), {delay: 20});
    continue //set year here
    // set the cvc
    await page.type("input[name=creditCard.securityCode]", kms.decrypt(process.env.creditCard.cvc), {delay: 20});
    // find button with text "Continue" click it
    await cursor.click("button[id=\"rc-shipping-group-continue\"]")
    // click continue
    await cursor.click("button[id=\"rc-shipping-group-continue\"]")
    // click continue
    await page.waitForSelector("button[id=\"rc-shipping-group-continue\"]")
    await cursor.click("button[id=\"rc-shipping-group-continue\"]")
    // find button with text "place order"
    // click button
    await page.waitForSelector("button[id=\"rc-place-order\"]")
    await cursor.click("button[id=\"rc-place-order\"]")
    // extract receipt information and return it
    // once we have this information, send the tracking number in an ebay to our purchaser
    continue

    // send mssage

    return new Promise(resolve => resolve('resolved'))
}


// WHAT'S LEFT?
// - ensure request goes through, and notify me if purchase fails
// - how does this lambda get triggered?
// - I need to extract the receipt info from the order 
// - and send an email to the purchaser

// lambda handler for use in aws
exports.handler =  async function(event, context) {
    // run our macy's search function
    try {
      console.log("Calling Macys purchase function...")
      return purchaseMacysItem(
        context
      )
    } catch(error) {
      console.error(`error running Macys purchase function: ${error}`)
      return new Promise(resolve => resolve('failed'))
    }
  }
  
// if __name__ == __main__ js equivalent
if (typeof require !== 'undefined' && require.main === module) {
    purchaseMacysItem("https://www.macys.com/shop/product/calvin-klein-shine-hooded-packable-down-puffer-coat-created-for-macys?ID=11031404&CategoryID=3536")
}
