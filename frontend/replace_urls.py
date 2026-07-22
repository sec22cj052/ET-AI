import os
import glob
import re

base_dir = r'c:\Users\krish\Downloads\ET-AI\industrial-knowledge-platform\frontend\src'
files = glob.glob(os.path.join(base_dir, '**', '*.tsx'), recursive=True)

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'http://localhost:8000' in content:
        # Simple replace for string literals enclosed in single quotes
        content = re.sub(
            r"'http://localhost:8000([^']*)'",
            r"`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}\1`",
            content
        )
        
        # Simple replace for string literals enclosed in double quotes
        content = re.sub(
            r'"http://localhost:8000([^"]*)"',
            r"`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}\1`",
            content
        )
        
        # Simple replace for string literals enclosed in backticks (template literals)
        content = re.sub(
            r"`http://localhost:8000([^`]*)`",
            r"`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}\1`",
            content
        )
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"Updated {os.path.basename(file)}")
