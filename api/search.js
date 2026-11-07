// api/search.js
const headers = {
  "Accept": "application/vnd.github+json",
  "User-Agent": "Ciphera"
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

async function getJSON(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Source returned ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function popularity(stars, forks, points) {
  return Math.round(
    Math.min(
      100,
      Math.log10(1 + stars) * 12 +
      Math.log10(1 + forks) * 8 +
      Math.log10(1 + points) * 8
    )
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET required" });
  }

  const q = String(req.query.q || "").trim().slice(0, 120);

  if (!q) {
    return res.status(400).json({ error: "Search query required." });
  }

  const githubURL =
    "https://api.github.com/search/repositories?q=" +
    encodeURIComponent(q) +
    "&sort=stars&order=desc&per_page=10";

  const hnURL =
    "https://hn.algolia.com/api/v1/search?query=" +
    encodeURIComponent(q) +
    "&tags=story&hitsPerPage=6";

  const [githubResult, hnResult] = await Promise.allSettled([
    getJSON(githubURL, { headers }),
    getJSON(hnURL)
  ]);

  const results = [];

  if (githubResult.status === "fulfilled") {
    for (const repo of githubResult.value.items || []) {
      results.push({
        id: `github-${repo.id}`,
        source: "GitHub",
        title: repo.full_name,
        description: repo.description || "No description provided.",
        url: repo.html_url,
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        language: repo.language || "Unknown",
        updated: repo.updated_at,
        score: popularity(
          repo.stargazers_count || 0,
          repo.forks_count || 0,
          0
        )
      });
    }
  }

  if (hnResult.status === "fulfilled") {
    for (const story of hnResult.value.hits || []) {
      results.push({
        id: `hn-${story.objectID}`,
        source: "Hacker News",
        title: story.title || "Untitled discussion",
        description: `${story.points || 0} points · ${story.num_comments || 0} comments`,
        url: story.url || `https://news.ycombinator.com/item?id=${story.objectID}`,
        stars: 0,
        forks: 0,
        language: "Discussion",
        updated: story.created_at,
        score: popularity(0, 0, story.points || 0)
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  return res.status(200).json({
    query: q,
    count: results.length,
    results,
    sources: {
      github: githubResult.status === "fulfilled",
      hackernews: hnResult.status === "fulfilled"
    }
  });
}
