/*global angular:false */
(function() {
"use strict";

var app = angular.module("foswikiServices", []);

app.factory("foswikiService", [
  '$http', 
  '$timeout', 
  '$log',
  '$rootScope',
  '$q', 
  '$location', 
  'foswikiAppSettings', 

  function(
    $http, 
    $timeout, 
    $log,
    $rootScope,
    $q, 
    $location, 
    foswikiAppSettings
  ) {

    var cache = {}, 
        templateRequests = {},
        canceler, 
        prevWeb;

    // request a specific template and poll them to be loaded in a batch
    function _requestTemplate(name, reload) {
      var deferred = $q.defer();

      reload = reload || 'topic';

      //$log.debug("requesting template",name,"reload=",reload);

      templateRequests[name] = {
        reload: reload,
        deferred: deferred
      };

      // will be resolved once the templates have been rendered
      return deferred.promise;
    }

    // process zones and inject to page
    function _processZones(zones) {

      angular.forEach(zones, function(zone, zoneName) {
          var zonePos = angular.element("."+zoneName).last();

        angular.forEach(zone, function(item) {
          var selector = "."+zoneName+"."+item.id.replace(/([^a-zA-Z0-9_\-])/g, '\\$1');

          if (!item.id.match(/^(JQUERYPLUGIN::FOSWIKI::PREFERENCES)?$/)) {
            if (angular.element(selector).length > 0) {
              //$log.debug("zone=",zoneName,"item ",item.id+" already loaded");
            } else {
              //$log.debug("... loading ",item.id,"to zone",zoneName);
              
              // load async'ly 
              $timeout(function() {
                zonePos.after(item.text);
              });
            }
          }
        });
      });
    }

    // contact the server and fetch all requrested templates
    function _render($scope) {
      var params,
          deferred = $q.defer();

      $log.debug("### requesting web=",$scope.web,"topic=",$scope.topic);

      params = {
        topic: $scope.web+'.'+$scope.topic,
        zones: [
          "head",
          "script"
        ],
        expand: [],
        urlparams: {}
      };

      angular.forEach(templateRequests, function(val, key) {
        //$log.debug("tempalteRequest=",val,"web=",$scope.web,"prevWeb=",prevWeb);
        if (val.reload === 'web') {
          if ( $scope.web !== prevWeb) {
            //$log.debug("... detected new web",$scope.web,"fetching",key);
            params.expand.push(key);
          } else {
            //$log.debug("... same web, not fetching",key);
            val.deferred.resolve(cache[key]);
          }
        } else {
          params.expand.push(key);
        }
      });

      // forward url params
      angular.forEach($location.search(), function(val, key) {
        params.urlparams[key] = val;
      });

      //$log.debug("params=",params);

      prevWeb = $scope.web;

      if (typeof(canceler) !== 'undefined') {
        $log.debug("cancelling previous request");
        canceler.resolve("aborded");
      }
      
      // new canceler
      canceler = $q.defer();

      // do the request
      $http({
        method: 'post',
        url: '/bin/jsonrpc/AngularPlugin/tmpl',
        timeout: canceler.promise,
        data: {
          jsonrpc: "2.0",
          params: params
        }
      })

      .success(function(data, status, header, config) {

        // finish request
        canceler = undefined;

        //$log.debug("response=",data);
        angular.forEach(data.result.expand, function(text, name) {
          var req = templateRequests[name];

          //$log.debug("name=",name,"req=",req);

          if (typeof(req) !== 'undefined') {
            cache[name] = text;
            req.deferred.resolve(text);
            delete templateRequests[name];
          }
        });

        // inject stuff that we need to display this topic
        _processZones(data.result.zones);

        // publish topic preferences
        $rootScope.preferences = data.result.preferences;
        //$log.debug("preferences=",$rootScope.preferences);

        // send to promise
        deferred.resolve(data);
      })

      .error(function(data) {

        // finish request
        canceler = undefined;

        // send to promise
        deferred.reject(data);
      });

      // return promise
      return deferred.promise;
    }

    return {
      requestTemplate: _requestTemplate,
      render: _render
    };
  }
]);

})();
