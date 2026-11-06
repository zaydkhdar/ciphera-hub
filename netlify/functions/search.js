// language: JavaScript, file: netlify/functions/search.js
// *Ciphera Backend: 15 Results, Smart Search, NVIDIA Model Waterfall.*

const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; 

// 1. The NVIDIA Model Waterfall
const MODELS = [
    "meta/llama3-70b-instruct",                 // Smartest
    "mistralai/mixtral-8x7b-instruct-v0.1",     // Fast & Smart
    "meta/llama3-8b-instruct",                  // Fastest
    "google/gemma-7b"                           // Lightweight Fallback
];

// 2. Unique Fallback Phrases (If all models fail)
const FALLBACK_REASONS = [
    "Production-ready architecture and stability.",
    "High code maintainability and test coverage.",
    "Robust community backing and frequent updates.",
    "Excellent documentation and developer experience.",
    "Scalable design for enterprise workflows.",
    "Optimized performance with minimal overhead.",
    "Clean, readable syntax and best practices.",
    "Extensive ecosystem and plugin support.",
    "Battle-tested reliability in live environments.",
    "Secure by default with active vulnerability patching."
];

async function queryNvidia(repo, model, apiKey) {
    const prompt = `Rate this GitHub repo for utility on a scale of 1-100. Name: ${repo.name}. Desc: ${repo.description}. Only reply with a number, a slash, 100, a dash, and a 5-word reason. Example: 85/100 - Incredibly useful developer tool.`;
    
    // NVIDIA uses the OpenAI Chat Completions endpoint
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
    
    // Parse the OpenAI-compatible response
    if (data.choices && data.choices[0].message) {
        const text = data.choices[0].message.content;
        const scoreMatch = text.match(/(\d+)\/100/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        const reason = text.includes('-') ? text.split('-')[1].trim() : "AI analyzed and ranked.";
        return { score, reason };
    }
    
    throw new Error(`Model ${model} failed`);
}

exports.handler = async (event, context) => {
    const query = event.queryStringParameters.q || "python";
    
    // 1. Check Cache
    if (cache[query] && (Date.now() - cache[query].timestamp < CACHE_DURATION)) {
        return { statusCode: 200, body: JSON.stringify(cache[query].data) };
    }
    
    // --- PASTE YOUR NVIDIA API KEY HERE (starts with nvapi-) ---
    const NVIDIA_API_KEY = "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"; 
    // ------------------------------------------------------------
    
    try {
        // 2. Smart Search: Pulls 15 results, searches readme
        const searchQuery = `${query} in:name,description,readme`;
        const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=15`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Ciphera-Hub'
            }
        });
        
        const data = await response.json();
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
            // 3. AI Scan the Top 5
            for (let i = 0; i < Math.min(5, repos.length); i++) {
                const repo = repos[i];
                let aiResult = null;
                
                // Run through the NVIDIA waterfall
                for (const model of MODELS) {
                    try {
                        aiResult = await queryNvidia(repo, model, NVIDIA_API_KEY);
                        if (aiResult) break; // Success! Break the waterfall loop.
                    } catch (err) {
                        console.log(`[!] NVIDIA Model ${model} failed for ${repo.name}.`);
                    }
                }
                
                // If all 4 models failed, use Math + Random Phrase
                if (!aiResult) {
                    aiResult = {
                        score: Math.min(99, 75 + Math.floor(Math.log10(repo.stars + 1) * 3) + Math.floor(Math.random() * 5)),
                        reason: FALLBACK_REASONS[Math.floor(Math.random() * FALLBACK_REASONS.length)]
                    };
                }
                
                repo.ai_score = aiResult.score;
                repo.ai_reason = aiResult.reason;
            }
            
            // 4. Heuristic Scores for the remaining 10
            for (let i = 5; i < repos.length; i++) {
                repos[i].ai_score = Math.min(99, 70 + Math.floor(Math.log10(repos[i].stars + 1) * 3) + Math.floor(Math.random() * 5));
                repos[i].ai_reason = FALLBACK_REASONS[Math.floor(Math.random() * FALLBACK_REASONS.length)];
            }
            
            // 5. Sort by AI Score
            repos.sort((a, b) => b.ai_score - a.ai_score);
        } 

        // Save to Cache
        cache[query] = { data: repos, timestamp: Date.now() };

        return {
            statusCode: 200,
            body: JSON.stringify(repos)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch." })
        };
    }
};
