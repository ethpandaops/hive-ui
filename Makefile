.PHONY: help setup dev build lint preview clean

# Default target
help:
	@echo "Available commands:"
	@echo "  setup    - Install dependencies"
	@echo "  dev      - Run development server"
	@echo "  build    - Build the application"
	@echo "  lint     - Run linter"
	@echo "  preview  - Preview production build"
	@echo "  clean    - Clean build artifacts"

setup:
	@echo "Installing dependencies..."
	npm install

dev:
	@echo "Starting development server..."
	npm run dev

build:
	@echo "Building application..."
	npm run build

lint:
	@echo "Running linter..."
	npm run lint

preview:
	@echo "Previewing production build..."
	npm run preview

clean:
	@echo "Cleaning build artifacts..."
	rm -rf node_modules
	rm -rf dist
