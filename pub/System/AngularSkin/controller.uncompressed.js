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
        prevUrl = '',
        isFirst = true, // true to prevent a service call on initial load
        blockLocationChange = false; // flag to mitigate cascading locationChangeStart events

    function _parseLocation() {

      var match,
          path = $location.path(),
          url = ($location.absUrl()||'').replace(/#.*/, ""),
          search = $location.search()||{},
          angularMode = search.angular_mode,
          web, topic;

      match = pathRegex.exec(path);

      if (match) {
        $scope.script = match[1] || 'view';
        web = match[2];
        topic = match[3];
      } else {
        $scope.script = 'view';
      }

      if (isFirst) {
        // if undefined get it from foswiki.preferences
        web = web || foswiki.preferences.WEB;
        topic = topic || foswiki.preferences.TOPIC;
      } else {
        // if undefined use default web.topic
        web = web || foswikiAppSettings.defaultWebName;
        topic = topic || foswikiAppSettings.homeTopicName;
      }

      web = web.replace(/^\/|\/$/g, "");
      topic = topic.replace(/^\/|\/$/g, "");

      // notify foswiki
      foswiki.preferences.WEB = web;
      foswiki.preferences.TOPIC = topic;

      //$log.debug("parse path=",path,"script=",$scope.script,"web=",web,"topic=",topic);

      // make sure the url is well-formed by redirecting to the current location
      // this could be the case using short urls and/or on the root location displaying the frontpage without a foswiki url prefix
      if (!url) {
        $location.url("/"+web+"/"+topic);
      }

      // switch off angular mode
      if (search.logout) {
        url = foswiki.getScriptUrl("view", web, topic, { logout: 1});
        $log.debug("logging out redirecting to ",url);
        window.location.href = url;
        return false;
      }

      // log out
      if (typeof(angularMode) !== 'undefined' && angularMode === "0") {
        // reload page 
        url = foswiki.getScriptUrl("view", web, topic, { angular_mode: 0});
        $log.debug("redirecting to ",url);
        window.location.href = url;
        return false;
      }


      if (web !== prevWeb || topic !== prevTopic) {
        $scope.web = prevWeb = web;
        $scope.topic = prevTopic = topic;
        prevUrl = url;
        if (isFirst) {
          isFirst = false;
        } else {
          angular.element(window).trigger("locationChanged"); 
          return true;
        }
      } else {
        if (url !== prevUrl) {
          prevUrl = url;
          $scope.forceReload = (new Date()).getTime();
        } else {
          // anchor click
        }
      }

      return false;
    }

    function _route() {
      blockLocationChange = true;
      $timeout(function() {
        foswikiService.render($scope).then(

          // success
          function(data) {
            blockLocationChange = false;

            // clear twisty store
            if (typeof(foswiki.TwistyPlugin) !== 'undefined') {
              angular.element(".twistyContent").hide();
              foswiki.TwistyPlugin._storage = {};
            }

            // scroll to top
            $window.scrollTo(0, 0);

            // TODO: close open modal dialogs

            $scope.$broadcast("foswiki.pageLoaded");
          },

          // error
          function(data) {
            blockLocationChange = false;
            if (data) {
              var msg = "ERROR "+data.error.code+": "+data.error.message;
              $log.error(msg);

              if (data.error.code === 401 && $scope.script !== 'login') {
                window.location.href = foswiki.getScriptUrl("login", $scope.web, $scope.topic);
              }
            } else {
              $log.debug("aborded previous request");
            }
          }
        );
      });
    }

    $scope.$on("$locationChangeStart", function(ev) {

      if (blockLocationChange) {
        $log.debug("woops cascading event ... error in angular?");
        ev.preventDefault();
        return;
      } 

      if (_parseLocation()) {
        _route();
        return;
      } 

      // temporarily block this event to prevent it from cascading
      blockLocationChange = true;
      $timeout(function() {
        blockLocationChange = false;
      });

    });

    $scope.$watch("forceReload", function() {
      if ($scope.forceReload) {
        _route();
      }
    });
  }
]);

})();
