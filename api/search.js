// language: JavaScript, file: api/search.js

export default async function handler(req, res) {
    const query = req.query.q || "python";
    
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const GITHUB_TOKEN = "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"; // PASTE YOUR TOKEN HERE

    const PHRASES = [
        "Optimized for high-throughput environments.", "Zero-configuration deployment architecture.", "Actively maintained with frequent security patches.",
        "Highly modular and easily extensible design.", "Exceptional memory management and low overhead.", "Comprehensive test coverage and CI/CD integration.",
        "Battle-tested in enterprise production workflows.", "Seamless integration with modern cloud providers.", "Clean, readable syntax following strict best practices.",
        "Vibrant ecosystem with extensive plugin support.", "Robust error handling and graceful degradation.", "Scalable microservices architecture out of the box.",
        "Advanced caching mechanisms for rapid data retrieval.", "Strong type safety and compile-time validation.", "Minimal dependencies for lightning-fast builds.",
        "Cross-platform compatibility with unified APIs.", "Intuitive developer experience and rich documentation.", "Proven track record of stability and uptime.",
        "Optimized algorithms for complex data structures.", "Elegant abstraction over complex system calls.",
        "High-performance thread management and concurrency.", "Secure by default with built-in encryption.", "Highly customizable routing and middleware layers.",
        "Active community with rapid issue resolution.", "Designed for edge computing and distributed networks.", "Streamlined deployment with Docker and Kubernetes."
    ];

    try {
        // Run all 3 API calls in parallel
        const [ghRes, hnRes, redditRes] = await Promise.allSettled([
            // 1. GitHub
            fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`, {
                headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Ciphera-Hub', 'Authorization': `Bearer ${GITHUB_TOKEN}` }
            }).then(r => r.json()),
            
            // 2. Hacker News (Algolia API - No Key Needed)
            fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`).then(r => r.json()),
            
            // 3. Reddit (Public JSON - Might fail on Vercel without a proxy)
            fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=5`, {
                headers: { 'User-Agent': 'Ciphera-Hub/1.0' }
            }).then(r => r.json()).catch(() => null) // Catch Reddit failure silently
        ]);

        let combinedResults = [];

        // --- PROCESS GITHUB ---
        if (ghRes.status === 'fulfilled' && ghRes.value.items) {
            ghRes.value.items.forEach(repo => {
                const daysSinceUpdate = Math.floor((new Date() - new Date(repo.pushed_at || repo.updated_at)) / (1000 * 60 * 60 * 24));
                let score = Math.log10(repo.stargazers_count + 1) * 15;
                if (daysSinceUpdate < 90) score += 10;
                
                combinedResults.push({
                    source: "🐙 GitHub",
                    name: repo.name,
                    owner: repo.owner.login,
                    description: repo.description || "No description provided.",
                    stars: repo.stargazers_count,
                    url: repo.html_url,
                    avatar: repo.owner.avatar_url,
                    ai_score: Math.max(50, Math.min(99, Math.floor(score))),
                    ai_reason: PHRASES[Math.floor(Math.random() * PHRASES.length)],
                    meta1: repo.license ? repo.license.spdx_id : "No License",
                    meta2: daysSinceUpdate === 0 ? "Updated today" : `Updated ${daysSinceUpdate}d ago`
                });
            });
        }

        // --- PROCESS HACKER NEWS ---
        if (hnRes.status === 'fulfilled' && hnRes.value.hits) {
            hnRes.value.hits.forEach(story => {
                combinedResults.push({
                    source: "🔶 Hacker News",
                    name: story.title.substring(0, 30) + "...",
                    owner: story.author,
                    description: `Discussion on Hacker News with ${story.num_comments} comments.`,
                    stars: story.points,
                    url: story.url || `https://news.ycombinator.com/item?id=${story.objectID}`,
                    avatar: "https://news.ycombinator.com/favicon.ico",
                    ai_score: Math.max(50, Math.min(99, Math.floor(Math.log10(story.points + 1) * 20))),
                    ai_reason: "High-signal tech discussion with strong community engagement.",
                    meta1: "Discussion",
                    meta2: story.created_at ? `Posted ${story.created_at.substring(0, 10)}` : "Recent"
                });
            });
        }

        // --- PROCESS REDDIT ---
        if (redditRes.status === 'fulfilled' && redditRes.value && redditRes.value.data && redditRes.value.data.children) {
            redditRes.value.data.children.forEach(post => {
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
                    ai_reason: "Trending discussion in the developer community.",
                    meta1: p.subreddit_name_prefixed,
                    meta2: p.upvote_ratio ? `${Math.floor(p.upvote_ratio * 100)}% Upvoted` : "Trending"
                });
            });
        }

        // Sort everything by Heat Index
        combinedResults.sort((a, b) => b.ai_score - a.ai_score);

        return res.status(200).json(combinedResults.slice(0, 15)); // Return top 15 mixed results
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
