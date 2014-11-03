/*global angular:false */
var foswikiApp;

(function() {
"use strict";

foswikiApp = angular.module("foswikiApp", [
  'foswikiAppSettings', 
  'foswikiServices', 
  'foswikiController', 
  'foswikiDirectives'
]);

foswikiApp.run([ "$log", 

  function( $log ) {
    $log.debug("### foswikiApp started");
  }
]);

})();
