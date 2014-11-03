/*global angular:false */
(function() {
"use strict";

var app = angular.module("foswikiAppSettings", ['angular-loading-bar']);

app.constant("foswikiAppSettings", {
  defaultWebName: 'Home',
  homeTopicName: 'WebHome'
});

app.config(['$locationProvider',
  function($locationProvider) {

    $locationProvider.html5Mode({
      enabled:true,
      requireBase: true
    });

    $locationProvider.hashPrefix('!');
  } 
]);

app.config(['cfpLoadingBarProvider', 
  function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
  }
]);

})();

