import glob, os

base_dir = r'c:\Users\krish\Downloads\ET-AI\industrial-knowledge-platform\frontend\src'
files = glob.glob(os.path.join(base_dir, '**', '*.tsx'), recursive=True)
count = 0
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the absolute backend URL logic with an empty string so it becomes relative
    new_content = content.replace("import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'", '""')
    
    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed {os.path.basename(file)}')
        count += 1

print(f'Fixed {count} files.')
