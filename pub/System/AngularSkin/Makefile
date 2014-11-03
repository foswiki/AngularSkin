FOSWIKI_ROOT?=~/foswiki/core

JS_SOURCES=\
	app.js \
	services.js \
	controller.js \
	settings.js \
	directives.js

CSS_SOURCES=\
	animate.css \
	app.css 

TARGET=\
	$(JS_SOURCES) \
	pkg.js \
	pkg.css 

include $(FOSWIKI_ROOT)/pub/System/JQueryPlugin/Makefile.include


pkg.uncompressed.js: $(JS_SOURCES:.js=.uncompressed.js)
	@echo generating $@
	@cat $^ > $@

pkg.uncompressed.css: $(CSS_SOURCES:.css=.uncompressed.css)
	@echo generating $@
	@cat $^ > $@


