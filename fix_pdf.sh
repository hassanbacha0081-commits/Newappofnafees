for file in src/components/*.tsx; do
  # Replace 100ms with 400ms to give React enough time to mount the DOM and load base64 images
  sed -i 's/}, 100);/}, 400);/g' "$file"
  
  # Ensure we handle null returned by generatePDF
  # Wait, sed might be tricky. Let's do it with a node script for safety.
done
