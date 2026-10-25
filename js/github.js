// Live GitHub data, shared by game mode (the room's board + panel) and normal mode.
//   const gh = GitHubData.create('DEV1033'); await GitHubData.load(gh);
// Contributions come from github-contributions-api.jogruber.de, the repo count
// from api.github.com. On failure `status` is 'error' and nothing is invented.
(() => {
  'use strict';
  const create = user => ({ user, status: 'loading', days: [], total: 0, streak: 0, activeDays: 0, best: null, repos: null, followers: null });

  async function load(gh) {
    if (!gh.user) { gh.status = 'error'; return gh; }
    try {
      const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(gh.user)}?y=last`);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const today = new Date().toISOString().slice(0, 10);
      gh.days = (d.contributions || []).filter(c => c.date <= today);
      gh.total = d.total?.lastYear ?? gh.days.reduce((a, c) => a + c.count, 0);
      gh.activeDays = gh.days.filter(c => c.count > 0).length;
      gh.best = gh.days.reduce((b, c) => (!b || c.count > b.count ? c : b), null);
      // current streak: consecutive active days ending today (or yesterday, if today is still empty)
      let i = gh.days.length - 1, streak = 0;
      if (i >= 0 && gh.days[i].count === 0) i--;
      while (i >= 0 && gh.days[i].count > 0) { streak++; i--; }
      gh.streak = streak;
      gh.status = gh.days.length ? 'ok' : 'error';
    } catch (e) {
      gh.status = 'error';
    }
    try {
      const r = await fetch(`https://api.github.com/users/${encodeURIComponent(gh.user)}`);
      if (r.ok) { const u = await r.json(); gh.repos = u.public_repos; gh.followers = u.followers; }
    } catch (e) { /* repo count is optional */ }
    return gh;
  }

  window.GitHubData = { create, load };
})();
