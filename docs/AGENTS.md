Beautiful is better than ugly.
Explicit is better than implicit.
Simple is better than complex.
Complex is better than complicated.
Flat is better than nested.
Sparse is better than dense.
Readability counts.
Special cases aren't special enough to break the rules.
Although practicality beats purity.
Errors should never pass silently.
Unless explicitly silenced.
In the face of ambiguity, refuse the temptation to guess.
There should be one-- and preferably only one --obvious way to do it.
Although that way may not be obvious at first unless you're Dutch.
Now is better than never.
Although never is often better than *right* now.
If the implementation is hard to explain, it's a bad idea.
If the implementation is easy to explain, it may be a good idea.
Namespaces are one honking great idea -- let's do more of those!

## Antigravity Knowledge Hub

For broad codebase questions, architecture questions, "where is X implemented",
"how does X work", dependency or impact analysis, or onboarding questions, prefer:

```bash
ag-ask "<question>" --workspace .
```

Use this before broad grep, rg, or file search when `.antigravity/` exists.

Run:

```bash
ag-refresh --workspace .
```

when `.antigravity/` is missing, stale, or after significant code changes.

Use direct file reads or rg only for:

- verifying exact lines after `ag-ask` gives candidate files
- narrow symbol or string searches
- editing or debugging specific files
- cases where `ag-ask` is unavailable or fails
