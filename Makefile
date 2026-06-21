.PHONY: electron

SHELL := /bin/bash

electron:
	@source "$$HOME/.nvm/nvm.sh" && nvm use && npm install && npm run electron:pack:mac
