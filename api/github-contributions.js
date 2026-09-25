// Proxies GitHub's own server-rendered contribution calendar instead of
// relying on a third-party mirror (github-contributions-api.jogruber.de),
// whose cache lagged real contributions by hours. GitHub's HTML has no CORS
// header, so the browser can't fetch it directly — this runs server-side
// (no CORS restriction here) and hands the page clean, fresh JSON.
module.exports = async (req, res) => {
  const username = String(req.query.username || "").replace(/[^a-zA-Z0-9-]/g, "");
  if (!username) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  try {
    const ghRes = await fetch(`https://github.com/users/${username}/contributions`);
    if (!ghRes.ok) throw new Error(`GitHub responded ${ghRes.status}`);
    const html = await ghRes.text();

    const tooltips = {};
    const tooltipRe = /<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g;
    let m;
    while ((m = tooltipRe.exec(html))) {
      tooltips[m[1]] = m[2].trim();
    }

    const contributions = [];
    const cellRe = /<td\s+[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g;
    let cell;
    while ((cell = cellRe.exec(html))) {
      const tag = cell[0];
      const date = cell[1];
      const levelMatch = tag.match(/data-level="(\d)"/);
      const idMatch = tag.match(/id="([^"]+)"/);
      const level = levelMatch ? Number(levelMatch[1]) : 0;
      const tooltipText = idMatch ? tooltips[idMatch[1]] : null;
      const countMatch = tooltipText && tooltipText.match(/^(\d+)/);
      const count = countMatch ? Number(countMatch[1]) : 0;
      contributions.push({ date, level, count });
    }

    if (contributions.length === 0) throw new Error("no contribution cells found");

    // GitHub's table markup is row-major (grouped by weekday across weeks,
    // not chronological), so the regex scan above picks cells up in that
    // order. The frontend assumes strictly ascending dates — sort them.
    contributions.sort((a, b) => a.date.localeCompare(b.date));

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ contributions });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch contributions", detail: String(err && err.message) });
  }
};
