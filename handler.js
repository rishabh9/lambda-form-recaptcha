'use strict';

import config from './config.json';
const request = require('request');
const qs      = require('querystring');

module.exports.form = (event, context, callback) => {
  var body = qs.parse(event.body);

  request.post(
    {
      "url"  : "https://www.google.com/recaptcha/api/siteverify",
      "form" : 
        {
              "secret"   : config.captchaSiteSecret,
              "response" : body['g-recaptcha-response'],
              "remoteip" : event.requestContext.identity.sourceIp
        }
    }, 
    function(error, httpResponse, body) {
      console.log("statusCode: " + httpResponse.statusCode);
      console.log("success: " + JSON.parse(body).success);
      console.log("error: "  + error);
      if (!error && httpResponse.statusCode == 200 && body.success) {
        // Print out the response body
        console.log("Recaptcha verified! Response was: " + body);
        console.log("Sending email...");

      } else {
        console.log("Error verifying recaptcha. Response was: " + body);
        callback(error);
      }
    }
  );
  
};
