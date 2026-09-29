# CSP Scheduling Challenge

A browser-based drag-and-drop game for introducing constraint satisfaction problems (CSPs). The public game is hosted on GitHub Pages. An optional Cloudflare Worker and D1 database provide anonymous visitor counts and encrypted completion records.

## What students do

1. Enter their name.
2. Assign Employees A–E to Shifts 1–5.
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

## Privacy and consent

Before beginning, students must consent to the collection of their completion information. The browser encrypts the student's name, completion date/time, elapsed time, and schedule with the instructor's public key before transmission. Cloudflare stores only ciphertext and cannot decrypt those details. The private key stays offline with the instructor.

After a student accepts the consent notice and starts the game, the site uses a random identifier stored in that browser to estimate unique visitors. It does not intentionally store IP addresses in the application database. The public page reveals only aggregate visitor and completion totals.

## Part 1 — Create the encryption keys offline

Do this on your own computer. Never upload the private key.

```bash
cd offline-tools
python -m pip install -r requirements.txt
python generate_keys.py
```

The script creates:

- `csp_private_key.pem`: keep this private and offline; back it up securely.
- `csp_public_key.pem`: safe to publish.

Open `csp_public_key.pem` and paste its complete contents into `PUBLIC_KEY_PEM` in `config.js`.

## Part 2 — Create the free Cloudflare backend

You need a free Cloudflare account and Node.js installed.

1. Open a terminal in the `backend` folder.
2. Sign in to Cloudflare:

   ```bash
   npx wrangler login
   ```

3. Create the D1 database:

   ```bash
   npx wrangler d1 create csp-scheduling-game-db
   ```

4. Copy the returned `database_id` into `backend/wrangler.jsonc`.
5. In `wrangler.jsonc`, replace `https://YOUR-USERNAME.github.io` with your GitHub Pages origin. Use only the origin, without the repository path. For example: `https://szehra.github.io`.
6. Create the database tables remotely:

   ```bash
   npx wrangler d1 execute csp-scheduling-game-db --remote --file=./schema.sql
   ```

7. Create a long, random admin token, then store it as a Worker secret:

   ```bash
   npx wrangler secret put ADMIN_TOKEN
   ```

   Enter the token when prompted and save a copy in your password manager.

8. Deploy the Worker:

   ```bash
   npx wrangler deploy
   ```

9. Copy the Worker URL shown after deployment into `API_BASE_URL` in `config.js`.

## Part 3 — Publish with GitHub Pages

1. Sign in to GitHub and create a new **public** repository, such as `csp-scheduling-game`.
2. Upload `index.html`, `style.css`, `script.js`, `config.js`, and `README.md` to the repository root. You may also keep the `backend` and `offline-tools` folders in the repository, but remove `csp_private_key.pem` if it is present.
3. Open the repository's **Settings**.
4. Select **Pages** in the left menu.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the `main` branch and the `/ (root)` folder, then click **Save**.
7. Wait a minute or two. GitHub will show the published address, usually:
   `https://YOUR-USERNAME.github.io/csp-scheduling-game/`
8. Share that address with students or place it in Canvas.

## Download the encrypted completion file

Run the following command, replacing the URL and token. The downloaded file contains ciphertext, not readable student names.

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://YOUR-WORKER.workers.dev/admin/export" \
  -o csp-completions-encrypted.json
```

## Decrypt the list offline

Keep the encrypted export and private key on your computer, then run:

```bash
cd offline-tools
python decrypt_export.py ../csp-completions-encrypted.json \
  --key csp_private_key.pem \
  --output csp_completions_decrypted.csv
```

Enter the private-key password when prompted. The resulting CSV contains the student names and completion details. Do not upload the decrypted CSV or private key to GitHub.

## Cost

GitHub Pages is free for eligible repositories, and the backend is designed for Cloudflare's free Workers and D1 allowances. A normal class activity uses only a few small requests per student. Review current Cloudflare limits before deploying and enable account notifications if desired.

## Security limitations

- The counters are educational, not audit-grade. A determined person could artificially increase them.
- Browser IDs estimate unique browsers, not guaranteed unique people.
- Encryption protects stored completion details, but students must still be informed and consent.
- Protect the admin token and private-key password.
- Follow your institution's rules for student records and retention.

## Customize the problem

Edit the rule text in `index.html`, then update the matching conditions in the `evaluate()` function in `script.js`. Styling is controlled in `style.css`.

## Current valid-schedule rules

- Use each employee exactly once.
- A must work a middle shift—Shift 2, 3, or 4.
- C must work immediately before A.
- D must work earlier than C.
- B must work later than A.
- E must work earlier than B.
- D and E cannot work adjacent shifts.

These rules have one valid schedule: **D→1, C→2, A→3, E→4, B→5**. The solution is intentionally not alphabetical, and students must combine ordering, immediacy, and non-adjacency constraints.
