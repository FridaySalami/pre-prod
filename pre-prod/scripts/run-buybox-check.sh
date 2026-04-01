#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if an argument was provided
if [ -z "$1" ]; then
  echo "Please provide a buybox_data entry ID as an argument"
  echo "Usage: ./run-buybox-check.sh <entry_id>"
  exit 1
fi

# Run the Node.js script with the provided ID
node check-buybox-entry.js "$1"
