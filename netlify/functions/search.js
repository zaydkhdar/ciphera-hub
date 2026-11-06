// language: JavaScript, file: netlify/functions/search.js
// *Netlify Serverless Function. Searches GitHub for repos.*

exports.handler = async (event, context) => {
    // 1. Get the search query from the URL
    const query = event.queryStringParameters.q || "python";
    
    try {
        // 2. Fetch from GitHub API (No token needed for public search, but rate-limited)
        const response = await fetch(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=12`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Ciphera-Hub'
            }
        });
        
        const data = await response.json();
        
        // 3. Format the data we want to send back
        const repos = data.items.map(repo => ({
            name: repo.name,
            owner: repo.owner.login,
            description: repo.description || "No description provided.",
            stars: repo.stargazers_count,
            url: repo.html_url,
            language: repo.language || "Unknown",
            avatar: repo.owner.avatar_url
        }));

        return {
            statusCode: 200,
            body: JSON.stringify(repos)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch from GitHub" })
        };
    }
};
