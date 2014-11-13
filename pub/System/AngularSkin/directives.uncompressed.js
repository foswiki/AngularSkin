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
    var viewScriptUrl = foswiki.getScriptUrl("view"),
        urlFilter = new RegExp("^"+viewScriptUrl+"/([A-Z_]\\w+(?:/[A-Z_]\\w+)*)/([^\/#]+)"),
        anchorFilter = new RegExp("^"+viewScriptUrl+"/[A-Z].*#"),
        excludeFilter = new RegExp(foswiki.getPreference("ANGULAR_EXCLUDE"));

    // rewrite local links
    function _rewriteUrls(content) {

if (0) {
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
}


    }

    return {

      scope: true,
      restrict: 'C',
      link: function(scope, elem, attrs) {
        var pageIn, pageOut, isFirst = true;

        //$log.debug("constructing elem with attrs=",attrs);

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
        function _clearAnimation() {
          var effect = elem.data("prevEffect");
          if (effect) {
            elem.removeClass(effect);
            elem.data("prevEffect", undefined);
          }
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
              break;
          }

          // broadcast event
          scope.$broadcast("foswiki.insertTemplate");

          // animate page in
          pageIn = _animate(attrs.pageInEffect);

          return content;
        }

        function _processContent(content) {
          if (content) {
            //_rewriteUrls(content);
            content.find(".foswikiCurrentTopicLink").on("click", function() {
              $rootScope.forceReload = (new Date()).getTime();
              $rootScope.$apply();
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

