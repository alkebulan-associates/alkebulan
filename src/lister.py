import json
import os
from ebaysdk.trading import Connection
# import yaml

def lambda_handler(event, context):
    """lambda function to list items to eBay's sandbox or production marketplace"""
    item_details = event["detail"]
    # item specific details
    title = item_details["title"]
    # market_environment
    market_environment = item_details["market_environment"]
    # price in dollars
    price = item_details["price"] 
    # generated description, possibly from website
    description = item_details["description"]
    # quantity
    quantity = item_details["quantity"]

    print(f"Hello from the eBay Item Lister Lambda! Now listing item: {title}")

    if market_environment == "sandbox":
        domain = "api.sandbox.ebay.com"
    elif market_environment == "production":
        domain = "api.ebay.com"
    else:
        raise ValueError(f"Invalid market_environment: {market_environment}")

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
    # get relevant item information from context:

    request = {
        "Item": {
            "Title": title,
            "Country": "US",
            "Location": "US",
            "Site": "US",
            "ConditionID": "1000", # new for now
            "PaymentMethods": "PayPal", # paypal for now
            "PayPalEmailAddress": os.environ["EMAIL"],
            # "PictureDetails": {"PictureURL": pict_list},
            "PrimaryCategory": {"CategoryID": "57989"}, # Clothing, Shoes & Accessories
            "Description": description, # description passed in from elsewhere
            "Quantity": "1",
            "ListingDuration": "GTC",
            "StartPrice": price,
            "Currency": "USD",
            "ListingType": "FixedPriceItem",
            "ItemSpecifics": {
                "NameValueList": [
                    {"Name": "Color", "Value": "Black"},
                    {"Name": "Brand", "Value": "Alternative"},
                    {"Name": "Size", "Value": "M"},
                    {"Name": "SizeType", "Value": "Regular"},
                    {"Name": "Inseam", "Value": "33"},
                    {"Name": "Style", "Value": "Polo Shirt"},
                    {"Name": "Sleeve Style", "Value": "Short Sleeve"},
                    {"Name": "Type", "Value": "Short Sleeve"},
                    {"Name": "Department", "Value": "Men"}
                ]
            },
            "ReturnPolicy": {
                "ReturnsAcceptedOption": "ReturnsNotAccepted", # to avoid handling two-step returns to two different places, we will
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
            "DispatchTimeMax": "2"
        }
    }
    
    # trigger request and log the response to cloudwatch    
    return api.execute("AddItem", request)

if __name__ == "__main__":
    # run test code
    context = None
    event = {
        "detail": {
            "title": "Alternative Gray Citadel Joggers",
            "price": "29.50",
            "market_environment": "sandbox",
            "description": "they're pretty good, just a lil worn and the drawstring is frayed",
            "quantity": "1"
        }
    }
    # print results
    print(lambda_handler(event, None))