// language: JavaScript, file: api/search.js

export default async function handler(req, res) {
    const query = req.query.q || "python";
    
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const GITHUB_TOKEN = "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"; // PASTE YOUR TOKEN HERE

    const PHRASES = [
        "Optimized for high-throughput environments.", "Zero-configuration deployment architecture.", "Actively maintained with frequent security patches.",
        "Highly modular and easily extensible design.", "Exceptional memory management and low overhead.", "Comprehensive test coverage and CI/CD integration.",
        "Battle-tested in enterprise production workflows.", "Seamless integration with modern cloud providers.", "Clean, readable syntax following strict best practices."
    ];

    try {
        const [ghRes, hnRes, redditRes] = await Promise.allSettled([
            // 1. GitHub
            fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=4`, {
                headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Ciphera-Hub', 'Authorization': `Bearer ${GITHUB_TOKEN}` }
            }).then(r => r.json()),
            
            // 2. Hacker News
            fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=4`).then(r => r.json()),
            
            // 3. Reddit (Using a public proxy because Vercel IPs are blocked by Reddit)
            fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.reddit.com/search.json?q=${query}&limit=4`)}`).then(r => r.json()).catch(() => null)
        ]);

        let combinedResults = [];

        // --- PROCESS GITHUB ---
        if (ghRes.status === 'fulfilled' && ghRes.value.items) {
            ghRes.value.items.forEach(repo => {
                combinedResults.push({
                    source: "🐙 GitHub",
                    name: repo.name,
                    owner: repo.owner.login,
                    description: repo.description || "No description provided.",
                    stars: repo.stargazers_count,
                    url: repo.html_url,
                    avatar: repo.owner.avatar_url,
                    ai_score: Math.max(50, Math.min(99, Math.floor(Math.log10(repo.stargazers_count + 1) * 20))),
                    ai_reason: PHRASES[Math.floor(Math.random() * PHRASES.length)],
                    meta1: repo.license ? repo.license.spdx_id : "No License",
                    meta2: "Open Source Code"
                });
            });
        }

        // --- PROCESS HACKER NEWS ---
        if (hnRes.status === 'fulfilled' && hnRes.value.hits) {
            hnRes.value.hits.forEach(story => {
                combinedResults.push({
                    source: "🔶 Hacker News",
                    name: story.title.substring(0, 35) + "...",
                    owner: story.author,
                    description: `Discussion with ${story.num_comments} comments.`,
                    stars: story.points,
                    url: story.url || `https://news.ycombinator.com/item?id=${story.objectID}`,
                    avatar: "https://news.ycombinator.com/favicon.ico",
                    ai_score: Math.max(50, Math.min(99, Math.floor(Math.log10(story.points + 1) * 20))),
                    ai_reason: "High-signal tech discussion with strong engagement.",
                    meta1: "Discussion",
                    meta2: "Hacker News"
                });
            });
        }

        // --- PROCESS REDDIT ---
        if (redditRes.status === 'fulfilled' && redditRes.value && redditRes.value.contents) {
            try {
                const redditData = JSON.parse(redditRes.value.contents);
                if (redditData.data && redditData.data.children) {
                    redditData.data.children.forEach(post => {
                        const p = post.data;
                        combinedResults.push({
                            source: "👽 Reddit",
                            name: p.subreddit_name_prefixed,
                            owner: p.author,
                            description: p.title,
                            stars: p.ups,
                            url: `https://reddit.com${p.permalink}`,
                            avatar: "https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-120x120.png",
                            ai_score: Math.max(50, Math.min(99, Math.floor(Math.log10(p.ups + 1) * 20))),
                            ai_reason: "Trending community discussion.",
                            meta1: p.subreddit_name_prefixed,
                            meta2: "Reddit Thread"
                        });
                    });
                }
            } catch (e) { console.log("Reddit parse failed"); }
        }

        combinedResults.sort((a, b) => b.ai_score - a.ai_score);
        return res.status(200).json(combinedResults.slice(0, 12)); 
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
