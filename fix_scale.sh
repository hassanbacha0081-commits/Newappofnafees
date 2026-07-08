for file in src/components/*.tsx; do
  sed -i 's/scale: 1.0,/scale: 3.0,/g' "$file"
done
