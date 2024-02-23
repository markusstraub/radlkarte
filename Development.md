# radlkarte.at - Development

Development guidelines for the website.


## Local environment

To test locally use a local webserver for serving the static files. This circumvents the CORS issue.

    npx http-server -a localhost -s

Then you can open it in the browser using http://localhost:8080.

Linting:

	npm i -g jshint html5-lint
	/usr/local/lib/node_modules/html5-lint/html5check.py index.html
	jshint radlkarte.js
