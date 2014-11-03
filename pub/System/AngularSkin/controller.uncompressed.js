/*global angular:false */
(function() {
"use strict";

var app = angular.module("foswikiController", []);

app.controller("ViewCtrl", [
  "$scope", 
  "$window", 
  "$timeout", 
  "$sce", 
  "$log",
  "$location",
  "foswikiService", 
  "foswikiAppSettings", 

  function(
    $scope, 
    $window, 
    $timeout, 
    $sce, 
    $log,
    $location,
    foswikiService, 
    foswikiAppSettings
  ) {
    var pathRegex = new RegExp("^\/(?:(view|login)\/)?((?:[^\/]+\/)+)([^\/]+)\/?$"),
        prevWeb = '',
        prevTopic = '',
        prevUrl = '';

    function _parseLocation() {

      var match,
          path = $location.path(),
          url = $location.absUrl().replace(/#.*/, ""),
          search = $location.search(),
          angularMode = search.angular,
          web, topic;

      match = pathRegex.exec(path);

      if (match) {
        $scope.script = match[1] || 'view';
        web = match[2] || foswikiAppSettings.defaultWebName;
        topic = match[3] || foswikiAppSettings.homeTopicName;
      } else {
        $scope.script = 'view';
        web = foswikiAppSettings.defaultWebName;
        topic = foswikiAppSettings.homeTopicName;
      }

      web = web.replace(/^\/|\/$/g, "");
      topic = topic.replace(/^\/|\/$/g, "");

      // notify foswiki
      foswiki.preferences.WEB = web;
      foswiki.preferences.TOPIC = topic;

      $log.debug("parse path=",path,"script=",$scope.script,"web=",web,"topic=",topic);

      if (typeof(angularMode) !== 'undefined' && angularMode === "0") {
        // reload page 
        var url = foswiki.getPreference("SCRIPTURL") + "/view/" + web + "/" + topic + "?angular=0";
        $log.debug("redirecting to ",url);
        window.location.href = url;
        return;
      }

      if (web !== prevWeb || topic !== prevTopic) {
        $scope.web = prevWeb = web;
        $scope.topic = prevTopic = topic;
        prevUrl = url;
        return true;
      } else {
        if (url !== prevUrl) {
          prevUrl = url;
          $scope.forceReload = (new Date()).getTime();
        }
      }

      return false
    }

    function _route() {
      $timeout(function() {
        foswikiService.render($scope).then(

          // success
          function(data) {
            $window.scrollTo(0, 0);
            $scope.$broadcast("foswiki.pageLoaded");
          },

          // error
          function(data) {
            if (data) {
              var msg = "ERROR "+data.error.code+": "+data.error.message;
              $log.error(msg);

              if (data.error.code === 401 && $scope.script !== 'login') {
                $location.path("/login/"+$scope.web+"/"+$scope.topic).replace();
              }
            } else {
              $log.debug("aborded previous request");
            }
          }
        );
      });
    }

    $scope.$on("$locationChangeSuccess", function() {
      if (_parseLocation()) {
        _route();
      }
    });

    $scope.$watch("forceReload", function() {
      if ($scope.forceReload) {
        _route();
      }
    });
  }
]);

})();
