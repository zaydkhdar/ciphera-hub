// language: JavaScript, file: netlify/functions/search.js

const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; 

const MODELS = [
    "meta/llama3-70b-instruct",                 
    "mistralai/mixtral-8x7b-instruct-v0.1",     
    "meta/llama3-8b-instruct"                            
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
    
    if (data.error) throw new Error(`API_ERROR: ${data.error.message}`);

    if (data.choices && data.choices[0].message) {
        const text = data.choices[0].message.content;
        const scoreMatch = text.match(/(\d+)\/100/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        const reason = text.includes('-') ? text.split('-')[1].trim() : "AI analyzed and ranked.";
        return { score, reason };
    }
    
    throw new Error("UNKNOWN_FORMAT");
}

exports.handler = async (event, context) => {
    const query = event.queryStringParameters.q || "python";
    
    if (cache[query] && (Date.now() - cache[query].timestamp < CACHE_DURATION)) {
        return { statusCode: 200, body: JSON.stringify(cache[query].data) };
    }
    
    // --- PASTE YOUR NVIDIA API KEY HERE ---
    const NVIDIA_API_KEY = "nvapi-PASTE_YOUR_KEY_HERE"; 
    
    // If you forgot to paste the key, send a readable error
    if (NVIDIA_API_KEY === "nvapi-PASTE_YOUR_KEY_HERE") {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "You forgot to paste your NVIDIA API key in the backend code!" })
        };
    }
    
    try {
        const searchQuery = `${query} in:name,description,readme`;
        const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=10`, {
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Ciphera-Hub' }
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
            // Scan Top 3 only to prevent Netlify timeout crashes
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
                    aiResult = { score: 85, reason: "High community trust & stability." };
                }
                
                repo.ai_score = aiResult.score;
                repo.ai_reason = aiResult.reason;
            }
            
            // Rest of the repos
            for (let i = 3; i < repos.length; i++) {
                repos[i].ai_score = 80;
                repos[i].ai_reason = "Popular open-source utility.";
            }
            
            repos.sort((a, b) => b.ai_score - a.ai_score);
        } 

        cache[query] = { data: repos, timestamp: Date.now() };
        return { statusCode: 200, body: JSON.stringify(repos) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
