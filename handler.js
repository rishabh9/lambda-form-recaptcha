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
      var jsonBody = JSON.parse(body);
      console.log("Recaptcha response: %j", jsonBody);
      console.log("error: %j", error);

      if (!error && httpResponse.statusCode == 200 && jsonBody.success) {

        console.log("Recaptcha verified!");
        console.log("Now sending email...");

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
              "Data": formData['name'] + " has left you a message on www.rishabh.me"
            }
          },
          "Source": config.sendMailsTo,
          "ReplyToAddresses": [ formData['_replyto'] ]
        };
        
        sesClient.sendEmail(emailParams, function (err, data) {
          if (err) {
            console.log("An error occurred while sending the email. Error: %j", err);
            callback(null, {"success": false, "message": "An error occurred sending the email!", "error": err});
          } else {
            console.log("Email sent successfully!");
            callback(null, {"success": true});
          }
        });

      } else {
        console.log("Error verifying Recaptcha!");
        callback(null, {"success": false, "message": "Error verifying recaptcha. You might be a robot!", "error": error});
      }
    }
  );
  
};
