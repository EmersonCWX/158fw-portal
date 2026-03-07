# Virtual 158th Fighter Squadron — Green Mountain Boys

Member portal for the Virtual Vermont Air National Guard (158th Fighter Squadron). Built as a static site using HTML/CSS/JS with [Supabase](https://supabase.com) for authentication and data storage.

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Public landing page + login |
| `airfield-status.html` | Live METAR, NOTAMs, airfield ops status |
| `briefing.html` | Mission briefing builder |
| `pre-mission.html` | Pre-mission checklist |
| `post-mission.html` | Post-mission debrief & flight log |
| `file.html` | ICAO flight plan filing |
| `flight-history.html` | Pilot flight history |
| `roster.html` | Squadron roster |
| `pilot.html` | Become a fighter pilot — application |
| `about.html` | About the squadron |
| `news.html` | News & updates |
| `admin.html` | Admin dashboard (restricted) |
| `vsaferep.html` | vSAFEREP safety reporting |

## Tech Stack

- Static HTML/CSS/JavaScript — no build step required
- [Supabase](https://supabase.com) — authentication, database, row-level security
- Hosted on GitHub Pages

## Setup

To deploy your own instance:

1. Create a [Supabase](https://supabase.com) project
2. Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/auth.js` and `js/member-nav.js`
3. In your Supabase dashboard → **Authentication → URL Configuration**, set:
   - **Site URL**: `https://<your-username>.github.io/<repo-name>`
   - **Redirect URLs**: same as above
4. Push to GitHub and enable **Pages** in repo Settings → Pages → Source: `main` branch, `/ (root)`
