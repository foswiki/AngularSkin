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

  function(
    $http, 
    $timeout, 
    $log,
    $rootScope,
    $q, 
    $location
  ) {

    var cache = {}, 
        templateRequests = {},
        canceler, 
        prevWeb,
        loadStart;

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
      loadStart = (new Date()).getTime();
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

        $rootScope.loadTime = ((new Date()).getTime() - loadStart);
        $log.log(params.topic+" took "+$rootScope.loadTime+"ms to load");
        
        // send to promise
        deferred.resolve(data);
      })

      .error(function(data) {

        // finish request
        canceler = undefined;

        $log.log("loading time: "+(new Date()).getTime() - loadStart);

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

/*global angular:false */
(function() {
"use strict";

var app = angular.module("foswikiDirectives", []);

app.directive('foswikiContents', [
  '$compile',
  '$log',
  '$timeout',
  '$q',
  '$rootScope',
  '$location',
  'foswikiService', 

  function(
    $compile, 
    $log, 
    $timeout, 
    $q, 
    $rootScope,
    $location,
    foswikiService
  ) {
    return {

      scope: true,
      restrict: 'C',
      link: function(scope, elem, attrs) {
        var pageIn, pageOut, isFirst = true;

        function _clearAnimation() {
          var effect = elem.data("prevEffect");
          if (effect) {
            elem.removeClass(effect);
            elem.data("prevEffect", undefined);
          }
        }

        function _processContent(content) {
          if (content) {
            //_rewriteUrls(content);
            content.find(".foswikiCurrentTopicLink").on("click", function() {
              var url = $location.absUrl(),
                  href = this.href;

              if (url === href) {
                $rootScope.forceReload = (new Date()).getTime();
                $rootScope.$apply();
              }
            });
          }
        }

        // create an amination effect; returns a promise that resolves when animation finished
        function _animate(effects) {
          var deferred, effect;

          if (!effects) {
            return;
          }

          deferred = $q.defer();

          if (typeof(effects) === 'string') {
            effects = effects.split(/\s*,\s*/);
            effect = effects[Math.floor(Math.random()*effects.length)];
          }

          elem.one("animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd", function(ev) {
            //$log.debug("animation "+effect+" ended for "+attrs.name);
            deferred.resolve();
          });

          $log.log(effect+" animation for",attrs.name);

          _clearAnimation();
          elem.data("prevEffect", effect);
          elem.addClass(effect);

          return deferred.promise;
        }

        function _insertTemplate(data) {
          $log.debug("inserting template ",attrs.name);

          var type = attrs.type || 'html',
              content;
        
          switch (type) {
            case 'html':
              content = angular.element(data);
              elem.html(content);      
              break;
            case 'angular':
              content = $compile(data)(scope);
              elem.html(content);      
              break;
            case 'text':
              elem.text(data);      
              break;
            case 'plain':
              elem.html(data);      
              break;
            default:
              throw "unknown content type '"+type+"'";
          }

          // broadcast event
          scope.$broadcast("foswiki.insertTemplate");

          // animate page in
          pageIn = _animate(attrs.pageInEffect);

          return content;
        }

        // contact foswikiService and request a template
        function _requestTemplate() {
          var type = attrs.type || 'html';

          if (isFirst && type === 'html' || type === 'angular') {
            _processContent(elem);
          } 

          if (isFirst) {
            isFirst = false;
          } else {

            // broadcast event
            scope.$broadcast("foswiki.requestTemplate");
            //$log.log("requestingTemplate "+attrs.name);

            // animate page out only if there is a page in effect as well
            if (pageIn) {
              pageOut = _animate(attrs.pageOutEffect);
            }

            // use service api
            foswikiService.requestTemplate(attrs.name, attrs.reload).then(function(data) {

              if (typeof(data) !== 'undefined') {
                if (attrs.delay) {
                  $timeout(function() {
                    _processContent(_insertTemplate(data));
                  }, attrs.delay);
                } else {
                  if (pageOut) {
                    pageOut.then(function() {
                      _processContent(_insertTemplate(data));
                    });
                  } else {
                    _processContent(_insertTemplate(data));
                    if (pageIn) {
                      pageIn.then(function() {
                        _clearAnimation();
                      });
                    }
                  }
                }
              }
            });
          }
        }

        if (attrs.reload === 'web') {
          scope.$watch("web", function(newVal, oldVal) {
            if (typeof(newVal) !== 'undefined') {
              _requestTemplate();
            }
          });
        } else {

          scope.$watchGroup(["web", "topic", "forceReload"], function(newVals, oldVals) {
            if (typeof(newVals[0]) !== 'undefined' && typeof(newVals[1]) !== 'undefined') { 
              _requestTemplate();
            }
          });

        }

        if (typeof(attrs.pageInEffect) !== 'undefined' || typeof(attrs.pageOutEffect) !== 'undefined') {
          elem.addClass("animated");
        }

        if (typeof(attrs.speed) !== 'undefined') {
          elem.addClass("speed-"+attrs.speed);
        }

      }
    };
  }

]);

})();

