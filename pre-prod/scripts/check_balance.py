#!/usr/bin/env python3
"""
HTML/Svelte Tag Balance Checker
This script checks for balanced HTML tags and Svelte blocks in a file.
"""

import re
import sys
from collections import deque
from typing import List, Tuple

def extract_tags_and_blocks(content: str) -> List[Tuple[str, int, str]]:
    """Extract HTML tags and Svelte blocks with their line numbers."""
    lines = content.split('\n')
    tags = []
    
    # Patterns for different types of tags/blocks
    html_tag_pattern = r'<(/?)(\w+)(?:\s[^>]*)?>|<(/?)(\w+)(?:\s[^>]*)?/>'
    svelte_block_pattern = r'\{(#|/)(\w+)(?:\s[^}]*)?\}'
    
    for line_num, line in enumerate(lines, 1):
        # Find HTML tags
        for match in re.finditer(html_tag_pattern, line):
            is_closing = bool(match.group(1) or match.group(3))
            tag_name = match.group(2) or match.group(4)
            if tag_name:
                tag_type = 'closing' if is_closing else 'opening'
                tags.append((tag_type, line_num, f'<{tag_name}>'))
        
        # Find Svelte blocks
        for match in re.finditer(svelte_block_pattern, line):
            block_type = match.group(1)
            block_name = match.group(2)
            if block_type == '#':
                tags.append(('opening', line_num, f'{{{block_name}}}'))
            elif block_type == '/':
                tags.append(('closing', line_num, f'{{{block_name}}}'))
    
    return tags

def check_balance(tags: List[Tuple[str, int, str]]) -> List[str]:
    """Check if tags are balanced and return any issues."""
    stack = deque()
    issues = []
    
    # Self-closing HTML tags that don't need closing tags
    self_closing = {'img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'}
    
    for tag_type, line_num, tag in tags:
        tag_name = tag.strip('<>{}').lower()
        
        # Skip self-closing tags
        if tag_name in self_closing:
            continue
            
        if tag_type == 'opening':
            stack.append((tag, line_num))
        elif tag_type == 'closing':
            if not stack:
                issues.append(f"Line {line_num}: Unexpected closing tag {tag} - no matching opening tag")
            else:
                opening_tag, opening_line = stack.pop()
                opening_name = opening_tag.strip('<>{}').lower()
                
                if opening_name != tag_name:
                    issues.append(f"Line {line_num}: Mismatched tags - expected {opening_tag} (opened on line {opening_line}) but found {tag}")
    
    # Check for unclosed tags
    while stack:
        unclosed_tag, line_num = stack.pop()
        issues.append(f"Line {line_num}: Unclosed tag {unclosed_tag}")
    
    return issues

def analyze_file(file_path: str):
    """Analyze a file for tag balance issues."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print(f"Analyzing: {file_path}")
        print("=" * 50)
        
        tags = extract_tags_and_blocks(content)
        
        # Show all tags for debugging
        print("\nAll tags found:")
        for tag_type, line_num, tag in tags:
            status = "OPEN " if tag_type == 'opening' else "CLOSE"
            print(f"  Line {line_num:4d}: {status} {tag}")
        
        print(f"\nTotal tags found: {len(tags)}")
        
        # Check balance
        issues = check_balance(tags)
        
        if issues:
            print(f"\n❌ Found {len(issues)} balance issues:")
            for issue in issues:
                print(f"  • {issue}")
        else:
            print("\n✅ All tags are balanced!")
        
    except FileNotFoundError:
        print(f"Error: File {file_path} not found")
    except Exception as e:
        print(f"Error analyzing file: {e}")

def main():
    if len(sys.argv) != 2:
        print("Usage: python check_balance.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    analyze_file(file_path)

if __name__ == "__main__":
    main()