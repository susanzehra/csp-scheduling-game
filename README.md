# CSP Scheduling Challenge

A small, browser-based drag-and-drop game for introducing constraint satisfaction problems (CSPs). It uses only HTML, CSS, and JavaScript, so it can be hosted free with GitHub Pages.

## What students do

1. Enter their name.
2. Assign Employees A–D to Shifts 1–4.
3. Check the schedule against five constraints.
4. Revise any inconsistent assignment.
5. Receive a personalized success screen showing their name, completion date/time, elapsed time, and valid schedule.

Students can drag cards or use the click-an-employee, click-a-shift alternative. The page is responsive and works on phones, tablets, and computers.

## Run it locally

Open `index.html` in a browser. No installation is required.

For a local web server, you may run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish with GitHub Pages

1. Sign in to GitHub and create a new **public** repository, such as `csp-scheduling-game`.
2. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the repository root.
3. Open the repository's **Settings**.
4. Select **Pages** in the left menu.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the `main` branch and the `/ (root)` folder, then click **Save**.
7. Wait a minute or two. GitHub will show the published address, usually:
   `https://YOUR-USERNAME.github.io/csp-scheduling-game/`
   In my case, the url is: https://susanzehra.github.io/csp-scheduling-game
9. Share that address with students or place it in Canvas.

## Important note about completion records

This version displays a completion certificate in the student's browser, but it does not send or store student names or results anywhere. Students can use **Print / Save as PDF** and submit the PDF or a screenshot in Canvas if evidence of completion is required.

## Customize the problem

Edit the rule text in `index.html`, then update the matching conditions in the `evaluate()` function in `script.js`. Styling is controlled in `style.css`.

## Current valid-schedule rules

- Use each employee exactly once.
- A cannot work Shift 4.
- B must work Shift 1 or Shift 2.
- C cannot work Shift 1.
- D must work a later shift than A.
