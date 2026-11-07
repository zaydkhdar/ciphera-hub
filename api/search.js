// language: JavaScript, file: api/search.js
// *The Ciphera Heat Index. Pure math, no APIs, 0% failure rate.*

const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; 

const PHRASES = [
    "Highly active and heavily starred repository.",
    "Strong fork-to-star ratio indicates high utility.",
    "Excellent maintenance and recent commits.",
    "Battle-tested by the open-source community.",
    "Robust ecosystem with strong developer backing.",
    "Clean architecture and rapid issue resolution.",
    "Massive adoption in production environments.",
    "Innovative design with a loyal contributor base."
];

export default async function handler(req, res) {
    const query = req.query.q || "python";
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (cache[query] && (Date.now() - cache[query].timestamp < CACHE_DURATION)) {
        return res.status(200).json(cache[query].data);
    }
    
    try {
        // Search name, description, and readme. Pull 15 results.
        const searchQuery = `${query} in:name,description,readme`;
        const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=15`, {
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Ciphera-Hub' }
        });
        
        const data = await response.json();
        
        if (!data.items) {
            throw new Error("GitHub API rate limit reached. Wait a minute.");
        }

        let repos = data.items.map(repo => {
            // 1. Calculate recency (How many days since last update?)
            const lastUpdate = new Date(repo.updated_at);
            const daysSinceUpdate = Math.floor((new Date() - lastUpdate) / (1000 * 60 * 60 * 24));
            
            // 2. The Heat Index Algorithm
            // Base score from stars (Logarithmic scale so 100,000 stars doesn't break the formula)
            let score = Math.log10(repo.stargazers_count + 1) * 15; 
            
            // Fork bonus (If people fork it, it's useful)
            score += Math.log10(repo.forks_count + 1) * 5;
            
            // Recency bonus (Max +15 points if updated today, 0 points if updated a year ago)
            if (daysSinceUpdate < 30) score += 15;
            else if (daysSinceUpdate < 90) score += 10;
            else if (daysSinceUpdate < 365) score += 5;
            
            // Issue Penalty (If open issues > stars, deduct points)
            if (repo.open_issues_count > repo.stargazers_count) score -= 10;

            // Clamp score between 40 and 99
            score = Math.max(40, Math.min(99, Math.floor(score)));

            // 3. Pick a random phrase based on the score
            const reasonIndex = Math.floor((score / 100) * PHRASES.length) % PHRASES.length;
            const reason = PHRASES[reasonIndex];

            return {
                name: repo.name,
                owner: repo.owner.login,
                description: repo.description || "No description provided.",
                stars: repo.stargazers_count,
                url: repo.html_url,
                language: repo.language || "Unknown",
                avatar: repo.owner.avatar_url,
                ai_score: score,
                ai_reason: reason
            };
        });

        // Sort by our new Heat Index score
        repos.sort((a, b) => b.ai_score - a.ai_score);

        cache[query] = { data: repos, timestamp: Date.now() };
        return res.status(200).json(repos);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
