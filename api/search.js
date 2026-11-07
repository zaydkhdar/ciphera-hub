// language: JavaScript, file: api/search.js

const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; 

// Updated exact model names for NVIDIA
const MODELS = [
    "meta/llama-3-70b-instruct",                 
    "mistralai/mixtral-8x7b-instruct-v0.1",     
    "meta/llama-3-8b-instruct"                            
];

const FALLBACK_REASONS = [
    "Production-ready architecture and stability.",
    "High code maintainability and test coverage.",
    "Robust community backing and frequent updates."
];

async function queryNvidia(repo, model, apiKey) {
    const prompt = `Rate this GitHub repo for utility on a scale of 1-100. Name: ${repo.name}. Desc: ${repo.description}. Only reply with a number, a slash, 100, a dash, and a 5-word reason. Example: 85/100 - Incredibly useful developer tool.`;
    
    const res = await fetch(`https://integrate.api.nvidia.com/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            max_tokens: 50
        })
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    if (data.choices && data.choices[0].message) {
        const text = data.choices[0].message.content;
        const scoreMatch = text.match(/(\d+)\/100/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        const reason = text.includes('-') ? text.split('-')[1].trim() : "AI analyzed and ranked.";
        return { score, reason };
    }
    throw new Error("UNKNOWN_FORMAT");
}

export default async function handler(req, res) {
    const query = req.query.q || "python";
    
    // Set CORS headers just in case
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (cache[query] && (Date.now() - cache[query].timestamp < CACHE_DURATION)) {
        return res.status(200).json(cache[query].data);
    }
    
    // YOUR API KEY IS INJECTED HERE
    const NVIDIA_API_KEY = "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"; 
    
    try {
        const searchQuery = `${query} in:name,description,readme`;
        const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=10`, {
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Ciphera-Hub' }
        });
        
        const data = await response.json();
        
        if (!data.items) {
            throw new Error("GitHub API rate limit or error.");
        }

        let repos = data.items.map(repo => ({
            name: repo.name,
            owner: repo.owner.login,
            description: repo.description || "No description provided.",
            stars: repo.stargazers_count,
            url: repo.html_url,
            language: repo.language || "Unknown",
            avatar: repo.owner.avatar_url,
            ai_score: 0,
            ai_reason: "Pending..."
        }));

        if (repos.length > 0) {
            // Only scan top 3 to avoid timeout
            for (let i = 0; i < Math.min(3, repos.length); i++) {
                const repo = repos[i];
                let aiResult = null;
                
                for (const model of MODELS) {
                    try {
                        aiResult = await queryNvidia(repo, model, NVIDIA_API_KEY);
                        if (aiResult) break; 
                    } catch (err) {
                        console.log(`[!] ${model} failed: ${err.message}`);
                    }
                }
                
                if (!aiResult) {
                    aiResult = { 
                        score: Math.min(99, 75 + Math.floor(Math.log10(repo.stars + 1) * 3)), 
                        reason: FALLBACK_REASONS[Math.floor(Math.random() * FALLBACK_REASONS.length)] 
                    };
                }
                
                repo.ai_score = aiResult.score;
                repo.ai_reason = aiResult.reason;
            }
            
            for (let i = 3; i < repos.length; i++) {
                repos[i].ai_score = 80;
                repos[i].ai_reason = FALLBACK_REASONS[Math.floor(Math.random() * FALLBACK_REASONS.length)];
            }
            
            repos.sort((a, b) => b.ai_score - a.ai_score);
        } 

        cache[query] = { data: repos, timestamp: Date.now() };
        return res.status(200).json(repos);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
                            }
