.PHONY: install demo test serve build screenshot clean

install:
	npm install

demo:
	npm run demo

test:
	npm test

build:
	npm run build

serve:
	npm run serve

# Generates the README screenshots with headless Chrome (server must be running).
CHROME = /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
screenshot:
	"$(CHROME)" --headless --disable-gpu --hide-scrollbars --window-size=1600,1000 \
		--virtual-time-budget=10000 --screenshot=screenshots/dashboard.png "http://localhost:4810/?screenshot=1"
	"$(CHROME)" --headless --disable-gpu --hide-scrollbars --window-size=1600,1000 \
		--virtual-time-budget=10000 --screenshot=screenshots/human-review.png "http://localhost:4810/?screenshot=1&review=1"

clean:
	rm -rf node_modules apps/web/dist out
