// language: JavaScript, file: api/search.js

export default async function handler(req, res) {
    const query = req.query.q || "python";
    
    // Stop Vercel from caching the results
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const PHRASES = [
        "Optimized for high-throughput environments.", "Zero-configuration deployment architecture.", "Actively maintained with frequent security patches.",
        "Highly modular and easily extensible design.", "Exceptional memory management and low overhead.", "Comprehensive test coverage and CI/CD integration.",
        "Battle-tested in enterprise production workflows.", "Seamless integration with modern cloud providers.", "Clean, readable syntax following strict best practices.",
        "Vibrant ecosystem with extensive plugin support.", "Robust error handling and graceful degradation.", "Scalable microservices architecture out of the box.",
        "Advanced caching mechanisms for rapid data retrieval.", "Strong type safety and compile-time validation.", "Minimal dependencies for lightning-fast builds.",
        "Cross-platform compatibility with unified APIs.", "Intuitive developer experience and rich documentation.", "Proven track record of stability and uptime.",
        "Optimized algorithms for complex data structures.", "Elegant abstraction over complex system calls.",
        "High-performance thread management and concurrency.", "Secure by default with built-in encryption.", "Highly customizable routing and middleware layers.",
        "Active community with rapid issue resolution.", "Designed for edge computing and distributed networks.", "Streamlined deployment with Docker and Kubernetes.",
        "Advanced telemetry and observability integrations.", "Lightweight footprint with massive scalability.", "Beautifully crafted API design and ergonomics.",
        "Built for real-time data streaming and processing.", "Rigorous fuzz testing and vulnerability scanning.", "Effortless state management and synchronization.",
        "Powerful CLI tooling for rapid scaffolding.", "Deep integration with GraphQL and RESTful endpoints.",
        "High-fidelity rendering and asset optimization.", "Automated load balancing and failover recovery.",
        "Frictionless onboarding for new contributors.", "Robust authentication and authorization flows.",
        "Modular architecture allowing hot-swappable components.", "Extremely low latency for critical applications.",
        "Innovative use of functional programming paradigms.", "Strong backward compatibility and versioning.",
        "Efficient garbage collection and resource pooling.", "Clear separation of concerns and clean architecture.",
        "Advanced debugging tools and stack tracing.", "Highly resilient against DDoS and injection attacks.",
        "Perfect for rapid prototyping and MVPs.", "Industry-standard compliance and data privacy.",
        "Fully asynchronous and non-blocking by design.", "Rich visualizations and interactive dashboards.",
        "Highly portable across serverless environments.", "Advanced machine learning integrations.",
        "Strict adherence to open-source licensing.", "Developer-first approach to API design.",
        "Dynamic scaling based on real-time traffic.", "Beautiful, accessible, and responsive UI components.",
        "Deep code analysis and static type checking.", "Robust offline support and synchronization.",
        "Powerful data transformation and mapping features.", "Clean documentation with interactive examples.",
        "Highly optimized for mobile and low-power devices.", "Seamless integration with legacy systems.",
        "Advanced compression and serialization protocols.", "Zero-downtime rolling deployments.",
        "Built-in rate limiting and traffic shaping.", "Exquisite handling of edge cases and errors.",
        "Powerful event-driven architecture.", "Extremely fast cold-start times.",
        "Highly extensible plugin ecosystem.", "Advanced caching headers and CDN optimization.",
        "Rigorous adherence to semantic versioning.", "Beautifully minimal and distraction-free design.",
        "Deep integration with modern IDEs.", "Robust transaction management and rollback.",
        "Automated dependency updates and patching.", "High-availability clustering and replication.",
        "Streamlined CI/CD pipeline integrations.", "Powerful query optimization and indexing.",
        "Fully containerized and orchestration-ready.", "Advanced logging and distributed tracing.",
        "Excellent for monolithic or microservice setups.", "Sleek command-line interface with autocomplete.",
        "Built-in support for WebSockets and SSE.", "Advanced cryptographic primitives and hashing.",
        "Perfectly balanced performance and usability.", "Highly customizable theming and styling.",
        "Massive community backing and funding.", "Excellent track record for bug fixes.",
        "Seamless continuous deployment workflows.", "Advanced data visualization capabilities.",
        "Ultra-low memory consumption under load.", "Robust plugin marketplace and extensions.",
        "Powerful ORM and database migrations.", "Excellent compatibility with modern browsers.",
        "Strong emphasis on developer happiness.", "Highly optimized rendering pipeline.",
        "Advanced state hydration and SSR support.", "Rigorous security audits and pen-testing.",
        "Clean, well-structured, and readable codebase.", "Powerful CLI for rapid project scaffolding.",
        "Highly resilient to network partitioning.", "Excellent integration with CI systems.",
        "Advanced rate limiting and backoff strategies.", "Beautifully designed component libraries.",
        "Rigorous adherence to accessibility standards.", "Seamless integration with third-party APIs.",
        "Highly optimized for high-frequency trading.", "Advanced caching and memoization.",
        "Perfectly suited for complex enterprise apps.", "Extremely responsive community support.",
        "Clean, minimalistic, and focused API surface.", "Robust handling of asynchronous operations."
    ];

    try {
        // Standard GitHub search without the strict formatting that breaks it
        const searchQuery = encodeURIComponent(query);
        const response = await fetch(`https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=15`, {
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Ciphera-Hub' }
        });
        
        const data = await response.json();
        
        if (!data.items) {
            throw new Error(data.message || "GitHub API error.");
        }

        let repos = data.items.map(repo => {
            const lastUpdate = new Date(repo.updated_at);
            const daysSinceUpdate = Math.floor((new Date() - lastUpdate) / (1000 * 60 * 60 * 24));
            
            // The Heat Index Algorithm
            let score = Math.log10(repo.stargazers_count + 1) * 15; 
            score += Math.log10(repo.forks_count + 1) * 5;
            
            if (daysSinceUpdate < 30) score += 15;
            else if (daysSinceUpdate < 90) score += 10;
            else if (daysSinceUpdate < 365) score += 5;
            
            if (repo.open_issues_count > repo.stargazers_count) score -= 10;

            // Clamp score between 45 and 99
            score = Math.max(45, Math.min(99, Math.floor(score)));

            // Pick a random phrase based on the score
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

        repos.sort((a, b) => b.ai_score - a.ai_score);

        return res.status(200).json(repos);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
