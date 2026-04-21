# External integrations imported into dMeter

This directory contains reusable components integrated from:

1) Jigsaw-Code/sensemaking-tools
- `jigsaw_csv_to_simple_format_txt.py`
- `jigsaw_csv_to_advanced_format.py`

Use these to convert proposition CSV files into Qualtrics-compatible survey formats for civic sensemaking workflows.

2) censoredplanet/censoredplanet-analysis
- `censoredplanet/domain_categories.csv`
- `censoredplanet_domain_category_tool.py`

Use these to categorize domains by censorship-relevant categories and generate summary JSON suitable for downstream dMeter analytics.

Example:

python3 scripts/integrations/censoredplanet_domain_category_tool.py   --input /path/to/domains.txt   --output /tmp/domain-category-summary.json
