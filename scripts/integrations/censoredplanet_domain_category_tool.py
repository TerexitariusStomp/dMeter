#!/usr/bin/env python3
"""
Derived from censoredplanet-analysis domain categorization approach.
Input: newline-delimited domains/URLs (stdin or --input file)
Output: JSON summary of category counts + per-domain category map.
"""

import argparse
import csv
import json
from pathlib import Path
from urllib.parse import urlparse

DATA_FILE = Path(__file__).parent / 'censoredplanet' / 'domain_categories.csv'

def load_categories():
    categories = {}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        r = csv.reader(f)
        for row in r:
            if len(row) >= 2:
                categories[row[0].strip()] = row[1].strip()
    return categories

def normalize_domain(value: str) -> str:
    v = value.strip()
    if not v:
        return ''
    if '://' not in v:
        v = 'http://' + v
    host = urlparse(v).netloc.lower()
    if host.startswith('www.'):
        host = host[4:]
    return host

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', help='Path to input text file (one domain/url per line). If omitted, read stdin.')
    p.add_argument('--output', help='Path to output JSON. Defaults to stdout.')
    args = p.parse_args()

    lines = Path(args.input).read_text(encoding='utf-8').splitlines() if args.input else __import__('sys').stdin.read().splitlines()
    categories = load_categories()

    per_domain = {}
    counts = {}
    unknown = 0
    for line in lines:
        d = normalize_domain(line)
        if not d:
            continue
        category = categories.get(d)
        per_domain[d] = category
        if category:
            counts[category] = counts.get(category, 0) + 1
        else:
            unknown += 1

    payload = {
        'input_count': len([x for x in lines if x.strip()]),
        'known_count': sum(counts.values()),
        'unknown_count': unknown,
        'category_counts': dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))),
        'domains': per_domain,
    }

    out = json.dumps(payload, indent=2)
    if args.output:
        Path(args.output).write_text(out + '
', encoding='utf-8')
    else:
        print(out)

if __name__ == '__main__':
    main()
