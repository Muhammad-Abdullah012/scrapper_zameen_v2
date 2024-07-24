#!/bin/bash

# Check if the number of arguments is not equal to 1
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <directory_name>"
    exit 1
fi

directory_name="$1"

# Check if the directory already exists
if [ -d "$directory_name" ]; then
    echo "Directory '$directory_name' already exists."
else
    # Create the directory
    mkdir "$directory_name"
    echo "Directory '$directory_name' created."
fi
