// language: JavaScript, file: netlify/functions/search.js
// *Ciphera Backend with Caching, Model Waterfall, and Heuristic Fallback.*

const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to query Gemini
async function queryGemini(repo, model, apiKey) {
    const prompt = `Rate this GitHub repo for utility on a scale of 1-100. Name: ${repo.name}. Desc: ${repo.description}. Only reply with a number, a slash, 100, a dash, and a 5-word reason. Example: 85/100 - Incredibly useful developer tool.`;
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const data = await res.json();
    
    if (data.candidates && data.candidates[0].content) {
        const text = data.candidates[0].content.parts[0].text;
        const scoreMatch = text.match(/(\d+)\/100/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        const reason = text.includes('-') ? text.split('-')[1].trim() : "AI analyzed and ranked.";
        return { score, reason };
    }
    
    throw new Error("Model failed or rate limited");
}

exports.handler = async (event, context) => {
    const query = event.queryStringParameters.q || "python";
    
    // 1. Check Cache
    if (cache[query] && (Date.now() - cache[query].timestamp < CACHE_DURATION)) {
        return { statusCode: 200, body: JSON.stringify(cache[query].data) };
    }
    
    // --- PASTE YOUR API KEY HERE ---
    const GEMINI_API_KEY = "AQ.Ab8RN6KgErTPTbYVtXbakg_RMfIprrh0fbObNYeYRA-qgxAJ1Q"; 
    // -------------------------------
    
    try {
        const response = await fetch(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=6`, {
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
            ai_reason: "Pending AI analysis..."
        }));

        if (GEMINI_API_KEY && GEMINI_API_KEY.length > 10 && repos.length > 0) {
            // Only AI-scan the top 2 to save massive amounts of API limits
            for (let i = 0; i < Math.min(2, repos.length); i++) {
                const repo = repos[i];
                let aiResult = null;
                
                // WATERFALL 1: Try Gemini 1.5 Flash (Fastest)
                try {
                    aiResult = await queryGemini(repo, "gemini-1.5-flash", GEMINI_API_KEY);
                } catch (err1) {
                    console.log(`[!] 1.5-flash failed for ${repo.name}. Trying 1.0-pro...`);
                    
                    // WATERFALL 2: Try Gemini 1.0 Pro (Older, usually has separate limits)
                    try {
                        await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
                        aiResult = await queryGemini(repo, "gemini-1.0-pro", GEMINI_API_KEY);
                    } catch (err2) {
                        console.log(`[!] All AI models failed for ${repo.name}. Using Heuristic Math.`);
                        
                        // WATERFALL 3: Mathematical Fallback (Based on Stars)
                        aiResult = {
                            score: Math.min(99, 75 + Math.floor(Math.log10(repo.stars + 1) * 3)),
                            reason: "High community trust & stability."
                        };
                    }
                }
                
                repo.ai_score = aiResult.score;
                repo.ai_reason = aiResult.reason;
            }
            
            // Heuristic scores for the rest
            for (let i = 2; i < repos.length; i++) {
                repos[i].ai_score = Math.min(99, 70 + Math.floor(Math.log10(repos[i].stars + 1) * 3));
                repos[i].ai_reason = "Popular open-source utility.";
            }
            
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
