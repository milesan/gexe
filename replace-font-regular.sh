#!/bin/bash

# This script replaces all instances of font-regular with font-mono 
# in .tsx and .css files in the src directory

echo "Replacing 'font-regular' with 'font-mono' across the codebase..."

# Find all occurrences in .tsx and .css files
grep -l "font-regular" --include="*.tsx" --include="*.css" -r src/ | while read file; do
  echo "Processing $file..."
  # Use sed to replace occurrences
  sed -i 's/font-regular/font-mono/g' "$file"
done

echo "Replacement complete!" 