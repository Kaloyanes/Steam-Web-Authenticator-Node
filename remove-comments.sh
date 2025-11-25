#!/bin/bash

for file in server/*.js public/js/*.js public/js/modules/*.js; do
    if [ -f "$file" ]; then
        sed -i '' 's/\/\/.*$//' "$file"
        sed -i '' '/\/\*/,/\*\//d' "$file"
    fi
done

for file in public/css/*.css; do
    if [ -f "$file" ]; then
        sed -i '' '/\/\*/,/\*\//d' "$file"
    fi
done

echo "All comments removed!"