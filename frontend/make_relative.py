import os
import glob
import re

base_dir = r'c:\Users\krish\Downloads\ET-AI\industrial-knowledge-platform\frontend\src'
files = glob.glob(os.path.join(base_dir, '**', '*.tsx'), recursive=True)

# We need to replace: `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/...` with `/...`
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # regex to find the exact pattern and replace with just the relative path
    # Pattern: `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/path`
    # We replace it with `'/path'` (standard string)
    new_content = re.sub(
        r"`\$\{import\.meta\.env\.VITE_BACKEND_URL \|\| 'http://localhost:8000'\}(/[^`]+)`",
        r"'\1'",
        content
    )
    
    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {os.path.basename(file)}")
