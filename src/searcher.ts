// How will I scrape for new items
// searcher -> 
// Lambda (in the future if the task is too long, we can use a batch container) that runs daily looking for products and posting them to the associated platforms if a deal looks legit
// pseudocode is:
// go to list formatted platforms
// search for deal
// if I find a product with a solid amount of listings and large enough profit is selling
// Post it on another platform

// load puppeteer
const puppeteer = require('puppeteer');

// const domain = "https://www.amazon.com";
const domain = "https://www.macys.com/shop/sale/Special_offers,Sortby/Clearance%2FCloseout,BEST_SELLERS?id=3536";

// process.env.NODE_ENV // "development"

// IIFE
(async () => {
  // wrapper to catch errors
  try {
    // create a new browser instance
    const browser = await puppeteer.launch({ headless: false });

    // create a page inside the browser;
    const page = await browser.newPage();

    // navigate to a website and set the viewport
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(domain, {
      // timeout: 5000  
    });
    
    // url list of items to push to SQS
    const results = await page.evaluate(() => {
      // url list of items to push to SQS (within the browser's scope)
      const resellItemUrls = [];
      const priceDifferences = [];
      // this code runs in the browser, and will not be outputted to the debuger
      // get all products from the sales clearance page
      const productsOnSale = Array.from(document.querySelectorAll('.productDescription'));
      console.log(productsOnSale);
      for (let productInfo of productsOnSale) {
        try {
          const originalPriceSpan = productInfo.getElementsByClassName('regular originalOrRegularPriceOnSale')[0];
          // split the span based on the dollar sign within it, then parse the price
          const originalPrice = parseFloat(originalPriceSpan.innerText.replace("$",""));
          console.log(`originalPrice: ${originalPrice}`)
          
          const salePriceSpan =  productInfo.getElementsByClassName('regular')[1]
          const salePrice = parseFloat(salePriceSpan.innerText.split("$")[1])
          console.log(`saleprice: ${salePrice}`);
          // if sale price is nan, meaning we have an item with a varying price range
          if(isNaN(salePrice)){
            // skip over it
            continue;
          }
          // ****************** GOLDEN RESELL RULE ******************
          // TODO: MOVE THIS OUTSIDE OF THE FUNCTION AND REFERENCE IT
          // IF THE PRICE DIFFERENCE PRICE IS ≥ $60 SELL IT
          const minimumPriceDifference = 60
          const priceDifference = (originalPrice - salePrice)
          if ( priceDifference > minimumPriceDifference ){
            // add items url to the list of items to sell on ebay
            resellItemUrls.push(
              productInfo.getElementsByTagName("a")[0].href
            )
            priceDifferences.push(
              priceDifference
              )
          }  
        } catch (error) {
          console.error(error);
        }
      }
      return {
        resellItemUrls,
        priceDifferences
      }
    });
    // const salePrice = 
    // const originalPrice = 
    
    
    // }
    // TODO
    // avoid limited time offers
    
    // ****************** GOLDEN RULE ******************
    
    console.log(`${results["resellItemUrls"].length} new reselling items: ${results["resellItemUrls"]} \nwith pre-sale margin of
     $${results.priceDifferences.reduce((a, b) => a + b, 0)}`)
    // close the browser
    await browser.close();
  } catch (error) {
    // display errors
    console.log(error)
  }
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
})();
