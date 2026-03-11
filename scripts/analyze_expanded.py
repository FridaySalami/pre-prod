#!/usr/bin/env python3
"""
Focused Svelte block structure checker for the isExpanded section
"""

def analyze_expanded_section(file_path: str):
    """Analyze the specific isExpanded block structure."""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Find the isExpanded block
    start_line = None
    end_line = None
    
    for i, line in enumerate(lines):
        if '{#if isExpanded}' in line:
            start_line = i + 1  # 1-based line numbering
            print(f"Found isExpanded block starting at line {start_line}")
            break
    
    if not start_line:
        print("Could not find '{#if isExpanded}' block")
        return
    
    # Analyze the structure from the isExpanded block
    div_stack = []
    if_stack = []
    
    print(f"\nAnalyzing structure from line {start_line}:")
    
    for i in range(start_line - 1, len(lines)):
        line_num = i + 1
        line = lines[i].strip()
        
        # Track opening divs
        if '<div' in line and not line.endswith('</div>') and '/>' not in line:
            div_stack.append(line_num)
            print(f"Line {line_num:4d}: OPEN  <div> (stack depth: {len(div_stack)})")
        
        # Track closing divs
        elif '</div>' in line:
            if div_stack:
                opened_at = div_stack.pop()
                print(f"Line {line_num:4d}: CLOSE </div> (opened at {opened_at}, stack depth: {len(div_stack)})")
            else:
                print(f"Line {line_num:4d}: ERROR </div> - NO MATCHING OPENING TAG")
        
        # Track if blocks
        elif '{#if' in line:
            if_stack.append(line_num)
            print(f"Line {line_num:4d}: OPEN  {{#if}} (stack depth: {len(if_stack)})")
        
        elif '{/if}' in line:
            if if_stack:
                opened_at = if_stack.pop()
                print(f"Line {line_num:4d}: CLOSE {{/if}} (opened at {opened_at}, stack depth: {len(if_stack)})")
            else:
                print(f"Line {line_num:4d}: ERROR {{/if}} - NO MATCHING OPENING TAG")
        
        # Check if we've reached the end of the isExpanded block
        if '{/if}' in line and len(if_stack) == 0 and start_line and 'isExpanded' not in line:
            end_line = line_num
            print(f"\nFound end of isExpanded block at line {end_line}")
            break
    
    print(f"\nSummary:")
    print(f"Unclosed <div> tags: {len(div_stack)} - opened at lines: {div_stack}")
    print(f"Unclosed {{#if}} blocks: {len(if_stack)} - opened at lines: {if_stack}")
    
    # Show the specific area around line 2778
    print(f"\nLines around 2775-2785:")
    for i in range(2774, min(2790, len(lines))):
        line_num = i + 1
        print(f"Line {line_num:4d}: {lines[i].rstrip()}")

if __name__ == "__main__":
    analyze_expanded_section("src/routes/buy-box-alerts/live/+page.svelte")