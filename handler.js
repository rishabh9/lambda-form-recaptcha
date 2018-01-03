'use strict';

const config  = require('./config.json');
const request = require('request');
const qs      = require('querystring');
const AWS     = require('aws-sdk');

var sesClient = new AWS.SES();

module.exports.form = (event, context, callback) => {

  var formData = qs.parse(event.body);

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
      var recaptchaResponse = JSON.parse(body);
      console.log("Recaptcha response: %j", recaptchaResponse);
      console.log("error: %j", error);

      if (!error && httpResponse.statusCode == 200 && recaptchaResponse.success) {

        console.log("Recaptcha verified! Now sending email...");

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
        
        sesClient.sendEmail(emailParams, function (err, data) {
          if (err) {
            console.log("An error occurred while sending the message. Error: %j", err);
            callback(null, prepareResponse(false, "An error occurred while sending your message.", err));
          } else {
            console.log("Email sent successfully!");
            callback(null, prepareResponse(true, "Thank You! Your message has been sent.", null));
          }
        });

      } else {
        console.log("Error verifying Recaptcha!");
        callback(null, prepareResponse(false, "An error occurred while verifying Recaptcha.", recaptchaResponse));
      }
    }
  );
  
};

var prepareResponse = (success, message, error) => {
  var statusCode = success ? 200 : 500;
  return {
    "statusCode": statusCode,
    "headers": {
        "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials" : false // Required for cookies, authorization headers with HTTPS
      },
    "body": JSON.stringify({ "success": success, "message": message, "error": error })
  };
};
