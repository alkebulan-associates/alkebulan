import json
import os
import sys
import logging
import traceback

# packages for listing to ebay
from ebaysdk.poller.orders import Poller

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)

class CustomStorage(object):
    def set(self, order):
        try:
            # what the fuck is this??
            print(order.OrderID)
            print(order.OrderStatus)
            print(dir(order))

            for txn in order.TransactionArray.Transaction:
                print("%s: %s" % (txn.TransactionID, txn.Item.Title))

        except Exception as e:
            pass
            #from IPython import embed; embed()

def monitor_orders():
    LOGGER.info(
        f"Hello from the eBay order checker Lambda! Now checking items"
    )
    if os.environ["ENV"] == "SANDBOX":
        domain = "api.sandbox.ebay.com"
    elif os.environ["ENV"] == "PRODUCTION":
        domain = "api.ebay.com"
    else:
        raise ValueError(f"Invalid market_environment: {os.environ['ENV']}")
    
    # create storage object 
    storage = CustomStorage()
    # ebay api params
    storage.domain = domain
    storage.config_file = os.environ['EBAY_YAML']
    storage.appid = os.environ["CLIENT_ID"]
    storage.certid = os.environ["DEV_ID"]
    storage.devid = os.environ["CLIENT_SECRET"]
    storage.token = os.environ["TOKEN"]
    storage.password = os.environ["PASSWORD"]
    storage.debug = True
    # ebay order specific parameters
    storage.OrderRole = "seller"
    storage.OrderStatus = "" #GET ALL
    storage.siteid = ""

    #!/usr/bin/env python3
    poller = Poller(storage, storage)
    poller.run()
    # trigger request and log the response to cloudwatch
    LOGGER.info(f"EBAY API RESPONSE: {response.status}")
    return response

def lambda_handler(event, context):
    """lambda function to check if any items have sold in a production marketplace
    
    runs: DAILY
    """
    # get our sqs queue
    sqs_queue = get_queue(os.environ["SQS_QUEUE_NAME"])
    # fetch the sqs queue messages in batches
    sqs_messages = receive_messages(queue=sqs_queue, max_number=2, wait_time=0)
    if len(sqs_messages) == 0:
        return { "status": 500, "message": "empty queue"} # The server encountered an unexpected condition which prevented it from fulfilling the request.
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

if __name__ == '__main__':
    (opts, args) = parse_args("usage: python -m samples.poller [options]")

    poller = Poller(opts, CustomStorage())
    poller.run()