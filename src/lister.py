import json
import os
from ebaysdk.trading import Connection

def lambda_handler(event, context):
    """lambda function to list items to eBay's sandbox or production marketplace"""
    item_details = event["detail"]
    # item specific details
    title = item_details["title"]
    # environment
    environment = item_details["environment"]
    # price in dollars
    price = item_details["price"] 
    # generated description, possibly from website
    description = item_details["description"]
    
    print(f"Hello from ebay Lister! Now listing item: {title}")

    if environment == "SANDBOX":
        domain = "api.sandbox.ebay.com"
    elif environment == "PRODUCTION":
        domain = "api.ebay.com"
    else:
        raise ValueError(f"Invalid environment: {environment}")

    #!/usr/bin/env python3
    api = Connection(
        config_file=os.environ.get('EBAY_YAML'),
        domain=domain,
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
            "PrimaryCategory": {"CategoryID": "11450"}, # Clothing, Shoes & Accessories
            "Description": description, # description passed in from elsewhere
            "ListingDuration": "GTC",
            "StartPrice": price,
            "Currency": "USD",
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