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
        urlFilter = new RegExp("^"+viewScriptUrl+"/([A-Z_]\\w+(?:/[A-Z_]\\w+)*)/([^\/#]+)"),
        anchorFilter = new RegExp("^"+angularScriptUrl+"/[A-Z].*#"),
        excludeFilter = new RegExp(foswiki.getPreference("ANGULAR_EXCLUDE"));

    // rewrite local links
    function _rewriteUrls(content) {

      // view urls
      content.find("a").filter(function() { 
        var href = this.href, 
            search = this.search,
            web, topic,
            match = true;

        // find view urls
        if (!urlFilter.test(href)) {
          match = false;
        } else {

          // test excludeFilter
          web = RegExp.$1;
          topic = RegExp.$2;

          if (excludeFilter.test(web+"."+topic)) {
            match = false;
          } else {

            // ignore links to that have a contenttype param. these are pdf links
            if (search) {
              search.replace(/^\?/, '').split('&').map(function(val) {
                var param = val.split('=');
                if (param[0] === "contenttype") {
                  match = false;
                }    
              });
            }
          }
        }

        return match;
      }).each(function() {

        var href = this.href.replace(viewScriptUrl, angularScriptUrl);
        //$log.debug("rewriting url ",this.href,"to", href);
        this.href = href;
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
                _rewriteUrls(content);
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

