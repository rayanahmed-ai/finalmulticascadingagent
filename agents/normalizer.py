#!/usr/bin/env python3
"""
Normalizer Component - Cleans and standardizes text before validation
Handles case, encodings, whitespace, and comment stripping
"""

import re
import urllib.parse

class Normalizer:
    def normalize(self, text: str) -> str:
        # 1. Lowercase everything
        text = text.lower()

        # 2. Decode URL encodings (e.g., %20 -> space, %2F -> /)
        text = urllib.parse.unquote(text)

        # 3. Collapse excessive whitespace
        text = re.sub(r"\s+", " ", text)

        # 4. Strip SQL-style comments
        text = re.sub(r"--.*", "", text)              # inline comments
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)  # block comments

        # 5. Normalize dangerous characters (optional cleanup)
        text = text.replace("\x00", "")  # remove null bytes

        return text