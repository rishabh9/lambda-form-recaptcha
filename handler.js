'use strict';

const config  = require('./config.json');
const request = require('request');
const qs      = require('querystring');
const AWS     = require('aws-sdk');

var sesClient = new AWS.SES();

module.exports.form = (event, context, callback) => {
  // Get the form data
  var formData = qs.parse(event.body);

  // Perform necessary validations...
  if (!config.captchaSiteSecret) {
    console.error("Recaptcha secret not configured");
    return callback(null, prepareErrorResponse("Recaptcha secret not configured"));
  }
  if (!config.sendMailsTo) {
    console.error("To email not configured");
    return callback(null, prepareErrorResponse("To email not configured"));
  }
  if (!formData['g-recaptcha-response']) {
    console.error("Recaptcha response not provided");
    return callback(null, prepareErrorResponse("Recaptcha response not provided"));
  }
  if (!formData['name']) {
    console.error("Name not provided");
    return callback(null, prepareErrorResponse("Name cannot be empty"));
  }
  if (!formData['_replyto']) {
    console.error("Email address not provided");
    return callback(null, prepareErrorResponse("Email cannot be empty"));
  }
  if (!formData['message']) {
    console.error("Message not provided");
    return callback(null, prepareErrorResponse("Message cannot be empty"));
  }

  // Post the acquired recaptcha response to Google to verify
  request.post( 
    {
      "url"  : "https://www.google.com/recaptcha/api/siteverify",
      "form" : 
        {
              "secret"   : config.captchaSiteSecret,
              "response" : formData['g-recaptcha-response'],
              "remoteip" : event.requestContext.identity.sourceIp
        }
    }, 
    function(error, httpResponse, body) {
      // Google has responded...
      var recaptchaResponse = JSON.parse(body);
      console.log("Recaptcha response: %j", recaptchaResponse);
      console.log("error: %j", error);

      if (!error && httpResponse.statusCode == 200 && recaptchaResponse.success) {
        console.log("Recaptcha verified! Now sending email...");
        // Set email parameters
        var emailParams = {
          "Destination": {
            "ToAddresses": [ config.sendMailsTo ]
          },
          "Message": {
            "Body": {
              "Text": {
                "Data": formData['message']
              }
            },
            "Subject": {
              "Data": formData['name'] + " has left you a message"
            }
          },
          "Source": config.sendMailsTo,
          "ReplyToAddresses": [ formData['_replyto'] ]
        };
        
        // Use the AWS SDK for SES and send the email
        sesClient.sendEmail(emailParams, function (err, data) {
          if (err) {
            console.error("An error occurred while sending the message. Error: %j", err);
            return callback(null, prepareErrorResponse("An error occurred while sending your message.", err));
          } else {
            console.log("Email sent successfully!");
            return callback(null, prepareResponse("Thank You! Your message has been sent."));
          }
        });

      } else {
        // Recaptcha validation failed
        console.error("Error verifying Recaptcha!");
        return callback(null, prepareErrorResponse("An error occurred while verifying Recaptcha.", recaptchaResponse));
      }
    }
  );
  
};

// Function to prepare a standard response structure
var prepareResponse = (message) => {
  return {
    "statusCode": 200,
    "headers": {
        "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials" : false // Required for cookies, authorization headers with HTTPS
      },
    "body": JSON.stringify({ "message": message })
  };
};

var prepareErrorResponse = (message, error) => {
  return {
    "statusCode": 500,
    "headers": {
        "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials" : false // Required for cookies, authorization headers with HTTPS
      },
    "body": JSON.stringify({ "message": message, "error": error })
  };
};
