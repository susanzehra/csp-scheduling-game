# Susan Zehra's CSP Challenge

A fully static browser activity for introducing constraint satisfaction problems through Australia map coloring, advanced district map coloring, and employee scheduling.

## Privacy

The activity does not use a backend, database, password, tracking, cookies, analytics, visitor counter, or completion counter. A student's name is used only in the current browser page to personalize the completion certificate. The name and solutions are not transmitted or stored by the activity.

## What students do

1. Enter their name.
2. Color the seven Australian regions so adjacent regions differ.
3. Solve a harder district-coloring problem with adjacency and domain restrictions.
4. Assign Employees A–E to five shifts while satisfying every scheduling constraint.
5. Print the personalized certificate or save it as a PDF.

## Files required on GitHub Pages

Upload these files to the repository root:

- `index.html`
- `style.css`
- `script.js`
- `README.md`

No Cloudflare Worker, database, encryption key, or configuration file is required.

## Run locally

Open `index.html` directly in a browser, or run:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish with GitHub Pages

1. Upload the four required files to the root of the GitHub repository.
2. Open the repository's **Settings**.
3. Select **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`.
6. Save and wait for GitHub Pages to redeploy.

If an older version remains visible, perform a hard refresh with `Command + Shift + R` on macOS or `Ctrl + Shift + R` on Windows.

## Current valid-schedule rules

- Use each employee exactly once.
- A must work Shift 2, 3, or 4.
- C must work immediately before A.
- D must work earlier than C.
- B must work later than A.
- E must work earlier than B.
- D and E cannot work adjacent shifts.

These rules have one valid schedule: **D→1, C→2, A→3, E→4, B→5**.

## Australia map-coloring rules

- Color WA, NT, SA, QLD, NSW, VIC, and TAS.
- Use only red, green, or blue.
- Regions sharing a land border must have different colors.
- Tasmania may use any available color.

## Advanced district map-coloring rules

- Use only red, green, blue, or orange.
- Adjacent districts must have different colors.
- Central District C must be orange.
- East District E must be blue.
- North District N cannot be red.
- West District W cannot be green.
- Northwest District NW must use the same color as East District E.
- South District S cannot be green.
- Southwest District SW cannot be blue.
