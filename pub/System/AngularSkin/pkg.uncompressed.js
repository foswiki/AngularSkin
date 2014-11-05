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
  '$anchorScroll',
  'foswikiService', 

  function(
    $compile, 
    $log, 
    $timeout, 
    $q, 
    $rootScope,
    $location,
    $anchorScroll,
    foswikiService
  ) {

    var viewScriptUrl = foswiki.getScriptUrl("origview"),
        angularScriptUrl = foswiki.getScriptUrl("angular"),
        urlFilter = new RegExp("^"+viewScriptUrl+"(?=/[A-Z])"),
        anchorFilter = new RegExp("^"+angularScriptUrl+"/[A-Z].*#"),
        excludeFilter = new RegExp(foswiki.getPreference("ANGULAR_EXCLUDE"));

    // rewrite local links
    function _rewriteUrls(content) {

      // view urls
      content.find("a").filter(function() { 
        var href = this.href;
        return urlFilter.test(href) && !excludeFilter.test(href); 
      }).each(function() {

        var $this = angular.element(this),
            search = this.search,
            href = this.href.replace(viewScriptUrl, angularScriptUrl),
            ignore = false;

        if (search) {
          search.replace(/^\?/, '').split('&').map(function(val) {
            var param = val.split('=');

            // ignore links to that have a contenttype param. these are pdf links
            if (param[0] === "contenttype") {
              ignore = true;
            }    
          });
        }

        if (ignore) {
          //$log.debug("ignoring ",href);
        } else {
          $log.debug("rewriting url ",this.href,"to", href);
          $this.attr("href", href);
        }
      });

      // view forms
if (0) {
      // anchor urls
      content.find("a").filter(function() { return anchorFilter.test(this.href); }).each(function() {
        var $this = angular.element(this),
            hash = this.href.replace(/^.*#/, "");

        $this.on("click", function(ev) {
          $log.debug("clicked hash link", hash);
          $timeout(function() {
            $location.hash(hash);
            $anchorScroll();
          });
          ev.preventDefault();
        });
      });
}


    }

    return {

      scope: true,
      restrict: 'C',
      link: function(scope, elem, attrs) {
        var pageIn, pageOut;

        //$log.debug("constructing elem with attrs=",attrs);

        // create an amination effect; returns a promise that resolves when animation finished
        function _animate(effect) {
          var deferred = $q.defer();

          elem.one("animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd", function(ev) {
            //$log.debug("animation "+effect+" ended for "+attrs.name);
            deferred.resolve();
          });

          //$log.debug("animation "+effect+" started for",attrs.name);

          if (typeof(attrs.pageInEffect) !== 'undefined') {
            elem.removeClass(attrs.pageInEffect);
          }

          if (typeof(attrs.pageOutEffect) !== 'undefined') {
            elem.removeClass(attrs.pageOutEffect);
          }

          elem.addClass(effect);

          return deferred.promise;
        }


        // contact foswikiService and request a template
        function _requestTemplate() {

          // broadcast event
          scope.$broadcast("foswiki.requestTemplate");
          //$log.log("requestingTemplate "+attrs.name);

          // animate page out
          if (typeof(pageIn) !== 'undefined' && typeof(attrs.pageOutEffect) !== 'undefined') {
            pageOut = _animate(attrs.pageOutEffect);
          }

          foswikiService.requestTemplate(attrs.name, attrs.reload).then(function(data) {

            function _doIt() {
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
                  break;
              }

              if (content) {
                //_rewriteUrls(content);
                content.find(".foswikiCurrentTopicLink").on("click", function() {
                  $rootScope.forceReload = (new Date()).getTime();
                  $rootScope.$apply();
                });
              }

              // broadcast event
              scope.$broadcast("foswiki.insertTemplate");

              // page in
              if (typeof(attrs.pageInEffect) !== 'undefined') {
                pageIn = _animate(attrs.pageInEffect);
              }
            }

            if (typeof(data) !== 'undefined') {
              if (attrs.delay) {
                $timeout(_doIt, attrs.delay);
              } else {
                if (pageOut) {
                  pageOut.then(_doIt);
                } else {
                  _doIt();
                }
              }
            }
          });
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

