// language: JavaScript, file: netlify/functions/search.js
// *Netlify Serverless Function with AI Ranking.*

exports.handler = async (event, context) => {
    const query = event.queryStringParameters.q || "python";
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // We will set this in Netlify
    
    try {
        // 1. Fetch from GitHub
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

        // 2. AI Analysis (Only run on the top 3 to save API limits)
        if (GEMINI_API_KEY && repos.length > 0) {
            for (let i = 0; i < Math.min(3, repos.length); i++) {
                const repo = repos[i];
                const prompt = `You are a senior software engineer. Rate this GitHub repository for utility and code quality on a scale of 1-100. 
                Name: ${repo.name}
                Description: ${repo.description}
                Language: ${repo.language}
                Only reply with a number and a 5-word reason. Format: "85/100 - Extremely useful utility"`;
                
                const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                
                const aiData = await aiRes.json();
                if (aiData.candidates && aiData.candidates[0].content) {
                    const aiText = aiData.candidates[0].content.parts[0].text;
                    // Extract score (e.g., "85/100 - Very good")
                    repo.ai_score = parseInt(aiText.split('/')[0]) || 0;
                    repo.ai_reason = aiText.split('-')[1]?.trim() || "Analyzed by AI";
                }
            }
            
            // Re-sort the array based on the AI Score!
            repos.sort((a, b) => b.ai_score - a.ai_score);
        }

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
