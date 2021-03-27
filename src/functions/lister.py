import json
import os
import sys
import logging
import traceback
import re
import boto3
import time
# helper functions
from queue_wrapper import *
from message_wrapper import *

# packages for listing to ebay
from ebaysdk.trading import Connection

# packages for the item info formatter
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

sqs = boto3.resource('sqs')
LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)

# Setting chrome options for our browser
user_agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.50 Safari/537.36'
chrome_options = Options()
# chrome_options.add_argument("--disable-extensions")
chrome_options.add_argument("--disable-gpu")
# chrome_options.add_argument("--no-sandbox") # linux only
chrome_options.add_argument("--headless")
chrome_options.add_argument(f'user-agent={user_agent}')
# chrome_options.add_argument("start-maximized")
# chrome_options.add_argument("disable-infobars")

def strip_text(string, rejoin_str=False):
    """removes all punctuation and from the string and returns comma separated list

    <div class="price" data-auto="main-price"> Orig. $190.00 </div>

    -> ['Orig', '190', '00']

    rejion_str == True -> Orig 190 00

    :param string -> string containing alphanumeric characters to be split into words
    """
    split_words = re.findall(r"[\w']+", string)
    # if we want to make the string into a sentence again
    if rejoin_str:
        # join the words together with spaces in each of them
        return " ".join(split_words)
    # return the original words split into a list
    return split_words

def get_macys_item_info(soup):
    """return the needed json/dictionary of a macys item in order to post it to eBay
    
    :param soup: BeautifulSoup() instance
    """
    item_details = {}
    # TITLE
    # filter title solely for words
    item_details["Title"] = strip_text(soup.find("div", attrs={"data-el": "product-title"}).text, rejoin_str=True)
    # DESCRIPTION
    item_details["Description"] = soup.find(attrs={"data-el": "product-details"}).text
    # IMAGES
    item_details["PictureDetails"] = []
    # for each img item in product detail
    for img_element in soup.find("ul", class_="c-reset scroller swiper animated").find_all("img"):
        # get elt xml
        xml_str = str(img_element)
        # get info after src attribute
        url = xml_str.split(" src=\"")[1]
        # clip info after next quote
        url = url[:url.find("\" ")]
        # append the image url
        item_details["PictureDetails"] += [{"PictureURL": url}]
    # PRICE
    # get original price html element
    price_html_text = soup.find(attrs={"data-auto": "main-price"}).text
    without_punctuation = strip_text(price_html_text)
    # get price, assuming it is the second element
    item_details["StartPrice"] = without_punctuation[1]
    ################# START ITEM SPECIFICS #################
    item_details["ItemSpecifics"] = {"NameValueList": [
        {"Name": "SizeType", "Value": "Regular"},
        # {"Name": "Inseam", "Value": "33"},
        # {"Name": "Sleeve Style", "Value": "Short Sleeve"}
    ]}
    name_value_list = item_details["ItemSpecifics"]["NameValueList"]
    #       --> Color
    name_value_list.append({
        "Name": "Color",
        "Value": soup.find(attrs={"data-auto": "selected-color"}).text
    })
    #       --> Brand
    name_value_list.append({
        "Name": "Brand",
        "Value": strip_text(soup.find(attrs={"data-auto": "product-brand"}).text, rejoin_str=True)
    })
    #       --> Size
    name_value_list.append({
        "Name": "Size",
        "Value": strip_text(
            soup.find("li", class_="swatch-itm static",
                      attrs={"aria-disabled": "false"}).text
        )[0]
    })
    # breadcrumbs --> ["Macy's", 'Women', 'Coats']
    breadcrumbs = strip_text(
        soup.find("div", class_="breadcrumbs-container").text)
    #       --> Department
    department = breadcrumbs[1]
    name_value_list.append({"Name": "Department", "Value": department})
    #       --> Style
    style = breadcrumbs[-1]
    name_value_list.append({"Name": "Style", "Value": style})
    #       --> Type
    item_type = breadcrumbs[-1]
    name_value_list.append({"Name": "Type", "Value": item_type})
    ################# END ITEM SPECIFICS #################
    return item_details

def format_item_details(message):
    item_details = None
    """Formats webpage data for the product into an ebay-friendly template
    
    :param message: message object representing message in the queue
    """
    host_functions = {
        "macys": get_macys_item_info
    }
    driver = webdriver.Chrome("./chromedriver", options=chrome_options)
    # Set the window size
    driver.set_window_size(1500, 1280)
    # get the url from the body of the sqs record
    item_url = message.body
    # go to said items webpage in selenium
    driver.get(item_url)
    # wait a specified amount of time for elements to be updated
    time.sleep(3)
    # pass the output to BS4
    soup = BeautifulSoup(driver.page_source, "xml")
    # close the window (all tabs)
    driver.quit()
    # get the specific host
    host = item_url.split(".")[1]
    # use function based on host
    try:
        # try to find our host url's function
        try:
            get_item_info = host_functions[host]
        except:
            LOGGER.error(f"failed to find get_item_info function for {host}")
            traceback.print_exc()
        # attempt to fetch the details for this item
        item_details = get_item_info(soup)
    except:
        LOGGER.error(f"failed to finish getting item info from {host}")
        traceback.print_exc()
        raise ValueError
    return item_details

def list_ebay_item(item_details):
    LOGGER.info(
        f"Hello from the eBay Item Lister Lambda! Now listing item: {item_details['Title']}"
    )
    if os.environ["ENV"] == "SANDBOX":
        domain = "api.sandbox.ebay.com"
    elif os.environ["ENV"] == "PRODUCTION":
        domain = "api.ebay.com"
    else:
        raise ValueError(f"Invalid market_environment: {os.environ['ENV']}")

    #!/usr/bin/env python3
    api = Connection(
        config_file=os.environ.get('EBAY_YAML'),
        domain=domain,
        appid=os.environ["CLIENT_ID"],
        certid=os.environ["DEV_ID"],
        devid=os.environ["CLIENT_SECRET"],
        token=os.environ["TOKEN"],
        password=os.environ["PASSWORD"],
        debug=True
    )
    # create set of style and dept for addition to category search
    title_specifics = set(["Style", "Department"])
    item_specifics = item_details["ItemSpecifics"]["NameValueList"]
    # get the suggested ebay category
    category_response = api.execute(
        'GetSuggestedCategories', {
            # concatenate the style and department
            'Query': " ".join(
                [item["Value"] for item in item_specifics if item["Name"] in title_specifics] + [item_details["Title"]]
            )
        }
    )
    # unwrap suggested categories
    suggested_categories = category_response.dict()['SuggestedCategoryArray']['SuggestedCategory']
    # set primary category
    primary_category_id = suggested_categories[0]["Category"]["CategoryID"]

    request = {
        "Item": {
            **item_details,
            # "Title": title,
            "Country": "US",
            "Location": "US",
            "Site": "US",
            "ConditionID": "1000",  # new for now
            "PaymentMethods": "PayPal",  # paypal for now
            "PayPalEmailAddress": os.environ["EMAIL"],
            # Clothing, Shoes & Accessories
            "PrimaryCategory": {"CategoryID": primary_category_id},
            # "PrimaryCategory": {"CategoryID": "57989"},
            # "Description": description, # description passed in from elsewhere
            "Quantity": "1",
            "ListingDuration": "GTC", # make a listing only last 14 days
            # "StartPrice": price,
            "Currency": "USD",
            "ListingType": "FixedPriceItem",
            # "ItemSpecifics": {
            #     "NameValueList": [
            #         {"Name": "Color", "Value": "Black"},
            #         {"Name": "Brand", "Value": "Alternative"},
            #         {"Name": "Size", "Value": "M"},
            #         {"Name": "SizeType", "Value": "Regular"},
            #         {"Name": "Inseam", "Value": "33"},
            #         {"Name": "Style", "Value": "Polo Shirt"},
            #         {"Name": "Sleeve Style", "Value": "Short Sleeve"},
            #         {"Name": "Type", "Value": "Short Sleeve"},
            #         {"Name": "Department", "Value": "Men"}
            #     ]
            # },
            # "PictureDetails": [
            #     { "PictureURL": "http://www.itcircleconsult.com/eb2017/4a.png" }
            # ],
            "ReturnPolicy": {
                # to avoid handling two-step returns to two different places, we will
                "ReturnsAcceptedOption": "ReturnsNotAccepted",
                # TODO: REMOVE THESE COMMENTS upon successful api call
                # "RefundOption": "MoneyBack",
                # "ReturnsWithinOption": "Days_30",
                # "Description": "If you are not satisfied, return the keyboard.",
                # "ShippingCostPaidByOption": "Seller"
            },
            "ShippingDetails": {
                "ShippingServiceOptions": {
                    "FreeShipping": "True",
                    "ShippingService": "USPSMedia"
                }
            },
            # Shorter dispatch times are always better if you can reliably meet them.
            "DispatchTimeMax": "2"
        }
    }

    # trigger request and log the response to cloudwatch
    response = api.execute("AddItem", request)
    print(response.status)
    return response


def lambda_handler(event, context):
    """lambda function to list items to eBay's sandbox or production marketplace"""
    # get our sqs queue
    sqs_queue = get_queue(os.environ["SQS_QUEUE_NAME"])
    # fetch the sqs queue messages in batches
    sqs_messages = receive_messages(queue=sqs_queue, max_number=2, wait_time=0)
    if len(sqs_messages) == 0:
        return { "status": 500, "body": "empty queue"} # The server encountered an unexpected condition which prevented it from fulfilling the request.
    # var for number of successful ebay postings
    successes = 0
    # for each message
    for msg in sqs_messages:
        try:
            # format the item in the message for posting
            item_details = format_item_details(msg)
            # list the item
            resp = list_ebay_item(item_details)
            LOGGER.warn(resp.text)
            successes += 1
        except:
            LOGGER.error(f"{msg.body} failed to be posted to ebay")
            traceback.print_exc()
    if successes == 2:
        return { "status": 200 } # full success
        LOGGER.error(f"{sqs_messages} successfully posted to ebay")
    elif successes == 1:
        return { "status": 206 } # The HTTP 206 Partial Content success status response code indicates that the request has succeeded and has the body contains the requested ranges of data
    else: #  successes ≤ 0 or successes ≥ 3
        return { "status": 500 } # The server encountered an unexpected condition which prevented it from fulfilling the request.


# TEST OBJECTS ####################################

event = {
    "detail": {
        "title": "Alternative Gray Citadel Joggers",
        "price": "29.50",
        "market_environment": os.environ["ENV"],
        "description": "they're pretty good, just a lil worn and the drawstring is frayed",
        "quantity": "1"
    }
}

event2 = {
    "message": [
        {
            "messageId": "059f36b4-87a3-44ab-83d2-661975830a7d",
            "receiptHandle": "AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...",
            "body": {
                "url": "https://www.macys.com/shop/product/calvin-klein-shine-hooded-packable-down-puffer-coat-created-for-macys?ID=11031427&CategoryID=3536,https://www.macys.com/shop/product/cole-haan-box-quilt-down-puffer-coat?ID=2813247&CategoryID=3536"
            },
            "attributes": {
                "ApproximateReceiveCount": "1",
                "SentTimestamp": "1545082649183",
                "SenderId": "AIDAIENQZJOLO23YVJ4VO",
                "ApproximateFirstReceiveTimestamp": "1545082649185"
            },
            "messageAttributes": {},
            "md5OfBody": "098f6bcd4621d373cade4e832627b4f6",
            "eventSource": "aws:sqs",
            "eventSourceARN": "arn:aws:sqs:us-east-2:123456789012:my-queue",
            "awsRegion": "us-east-2"
        }
    ]
}


if __name__ == "__main__":
    # run test code
    context = None
    # print results
    print(lambda_handler(event2, None))

#  {
#      'Category': 
#      {'CategoryID': '2887', 'CategoryName': 'Soccer-International 
#  Clubs', 'CategoryParentID': ['64482', '24409'], 'CategoryParentName': 
#  ['Sports Mem, Cards &amp; Fan Shop', 'Fan Apparel &amp; Souvenirs']}, 
#  'PercentItemFound': '89'}
